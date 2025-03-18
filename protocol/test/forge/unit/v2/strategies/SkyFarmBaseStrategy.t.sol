pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../../TempleTest.sol";
import { SkyFarmBaseStrategy } from "contracts/v2/strategies/SkyFarmBaseStrategy.sol";
import { GnosisStrategy } from "contracts/v2/strategies/GnosisStrategy.sol";
import { IERC4626 } from "@openzeppelin/contracts/interfaces/IERC4626.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { TempleDebtToken } from "contracts/v2/TempleDebtToken.sol";
import { ITreasuryReservesVault, TreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";
import { TreasuryPriceIndexOracle } from "contracts/v2/TreasuryPriceIndexOracle.sol";
import { TempleCircuitBreakerAllUsersPerPeriod } from "contracts/v2/circuitBreaker/TempleCircuitBreakerAllUsersPerPeriod.sol";
import { TempleCircuitBreakerProxy } from "contracts/v2/circuitBreaker/TempleCircuitBreakerProxy.sol";
import { ITempleDebtToken } from "contracts/interfaces/v2/ITempleDebtToken.sol";
import { IDaiUsds } from "contracts/interfaces/external/sky/IDaiUsds.sol";

import { ud } from "@prb/math/src/UD60x18.sol";

interface OrigamiErc4626 is IERC4626 {
    function manager() external view returns (OrigamiSkyManager);
}

struct Farm {
    address staking;
    IERC20 rewardsToken;
    uint16 referral;
}

struct FarmDetails {
    Farm farm;
    uint256 stakedBalance;
    uint256 totalSupply;
    uint256 rewardRate;
    uint256 unclaimedRewards;        
}
interface OrigamiSkyManager{
    function farmDetails(uint32[] calldata farmIndexes) external view returns (
        FarmDetails[] memory
    );
}

/* solhint-disable func-name-mixedcase, not-rely-on-time */
contract SkyFarmBaseStrategyTestBase is TempleTest {
    SkyFarmBaseStrategy public strategy;

    IERC20 public constant temple = IERC20(0x470EBf5f030Ed85Fc1ed4C2d36B9DD02e77CF1b7);
    IERC20 public constant dai = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    IERC20 public constant usds = IERC20(0xdC035D45d973E3EC169d2276DDab16f1e407384F);
    IDaiUsds public constant daiToUsds = IDaiUsds(0x3225737a9Bbb6473CB4a45b7244ACa2BeFdB276A);
    OrigamiErc4626 public constant origamiSkyVault = OrigamiErc4626(0x0f90a6962e86b5587b4c11bA2B9697dC3bA84800);

    FakeERC20 public frax = new FakeERC20("FRAX", "FRAX", address(0), 0);
    FakeERC20 public immutable usdc = new FakeERC20("USDC", "USDC", address(0), 0);

    // 6.5% APY, which is how sUSDS is calculated as of block #21067150
    // dUSD is represented in APY (continuously compounded), so need to convert in order to match
    // Nb this is ln(1.065). See `test_dsr_interest_equivalence()` below
    uint96 public constant DEFAULT_BASE_INTEREST = 0.086177696241052323e18;
    TempleDebtToken public dUSD;
    TreasuryPriceIndexOracle public tpiOracle;
    TreasuryReservesVault public trv;

    address[] public reportedAssets = [address(dai), address(frax), address(0)];

    event DaiDeposited(uint256 amount);
    event DaiWithdrawn(uint256 amount);

    function _setUp() internal {
        fork("mainnet", 21067150);

        dUSD = new TempleDebtToken("Temple Debt", "dUSD", rescuer, executor, DEFAULT_BASE_INTEREST);
        tpiOracle = new TreasuryPriceIndexOracle(rescuer, executor, 0.97e18, 0.1e18, 0, 1e16);
        trv = new TreasuryReservesVault(rescuer, executor, address(tpiOracle));
        strategy = new SkyFarmBaseStrategy(rescuer, executor, "SkyFarmBaseStrategy", address(trv), address(origamiSkyVault), address(daiToUsds));

        vm.startPrank(executor);
        dUSD.addMinter(executor);
        vm.stopPrank();
    }

    function expectOnlyTrv() internal {
        vm.prank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(ITempleStrategy.OnlyTreasuryReserveVault.selector, unauthorizedUser));
    }
}

contract SkyFarmBaseStrategyTestAdmin is SkyFarmBaseStrategyTestBase {
    event TreasuryReservesVaultSet(address indexed trv);

    function setUp() public {
        _setUp();
    }

    function test_dsr_interest_equivalence() public pure {
        uint256 dsrRate = 1.095e18;
        uint256 equivalentDusdRate = ud(dsrRate).ln().unwrap();
        assertEq(equivalentDusdRate, 0.090754363268464133e18);
    }

    function test_initalization() public view {
        assertEq(strategy.executor(), executor);
        assertEq(strategy.rescuer(), rescuer);
        assertEq(strategy.apiVersion(), "1.0.0");
        assertEq(strategy.strategyName(), "SkyFarmBaseStrategy");
        assertEq(strategy.strategyVersion(), "1.0.0");
        assertEq(address(strategy.treasuryReservesVault()), address(trv));
        assertEq(address(strategy.daiToken()), address(dai));
        assertEq(address(strategy.usdsToken()), address(usds));
        assertEq(address(strategy.usdsVaultToken()), address(origamiSkyVault));
        assertEq(address(strategy.daiToUsds()), address(daiToUsds));

        ITempleStrategy.AssetBalanceDelta[] memory adjs = strategy.manualAdjustments();
        assertEq(adjs.length, 0);

        assertEq(dai.allowance(address(strategy), address(trv)), type(uint256).max);
        assertEq(strategy.latestDaiBalance(), 0);
    }

    function test_setTreasuryReservesVault() public {
        vm.startPrank(executor);
        TreasuryReservesVault trv2 = new TreasuryReservesVault(rescuer, executor, address(tpiOracle));
        vm.expectEmit(address(strategy));
        emit TreasuryReservesVaultSet(address(trv2));
        strategy.setTreasuryReservesVault(address(trv2));
        assertEq(address(strategy.treasuryReservesVault()), address(trv2));

        assertEq(dai.allowance(address(strategy), address(trv)), 0);
        assertEq(dai.allowance(address(strategy), address(trv2)), type(uint256).max);
    }
}

contract SkyFarmBaseStrategyTestAccess is SkyFarmBaseStrategyTestBase {
    function setUp() public {
        _setUp();
    }

    function test_access_borrowAndDeposit() public {
        expectElevatedAccess();
        strategy.borrowAndDeposit(0);
    }

    function test_access_withdrawAndRepay() public {
        expectElevatedAccess();
        strategy.withdrawAndRepay(0);
    }

    function test_access_withdrawAndRepayAll() public {
        expectElevatedAccess();
        strategy.withdrawAndRepayAll();
    }

    function test_access_trvDeposit() public {
        expectOnlyTrv();
        strategy.trvDeposit(0);
    }

    function test_access_trvWithdraw() public {
        expectOnlyTrv();
        strategy.trvWithdraw(0);
    }

    function test_access_automatedShutdown() public {
        expectElevatedAccess();
        strategy.automatedShutdown("");
    }
}

contract SkyFarmBaseStrategyTestBorrowAndRepay is SkyFarmBaseStrategyTestBase {
    uint256 public constant TRV_STARTING_BALANCE = 10e18;
    uint256 public constant BORROW_CEILING = 1.01e18;

    event Shutdown();
    event Repay(address indexed strategy, address indexed token, address indexed from, uint256 amount);
    event StrategyShutdownCreditAndDebt(address indexed strategy, address indexed token, uint256 outstandingCredit, uint256 outstandingDebt);
    event StrategyCreditAndDebtBalance(address indexed strategy, address indexed token, uint256 credit, uint256 debt);
    event StrategyRemoved(address indexed strategy);

    function setUp() public {
        _setUp();

        // Add the new strategy, and setup TRV such that it has stables 
        // to lend and issue dUSD.
        vm.startPrank(executor);

        ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
        debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), BORROW_CEILING);
        trv.setBorrowToken(dai, address(strategy), 0, 0, address(dUSD));
        trv.addStrategy(address(strategy), -123, debtCeiling);

        deal(address(dai), address(trv), TRV_STARTING_BALANCE, true);
        dUSD.addMinter(address(trv));
        vm.stopPrank();
    }

    function test_borrowAndDeposit() public {       
        uint256 amount = 1e18;
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE);

        uint256 available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, BORROW_CEILING);

        vm.expectEmit(address(strategy));
        emit DaiDeposited(amount);

        vm.startPrank(executor);
        strategy.borrowAndDeposit(amount);

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE-amount);
        assertApproxEqAbs(strategy.latestDaiBalance(), amount, 1); // vault rounding

        assertEq(dUSD.balanceOf(address(strategy)), amount);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, 0.01e18);

        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.DebtCeilingBreached.selector, 0.01e18, 0.02e18));
        strategy.borrowAndDeposit(0.02e18);
    }  

    function test_withdrawAndRepay() public {
        uint256 borrowAmount = 1e18;
        uint256 repayAmount = 0.25e18;
        vm.startPrank(executor);
        strategy.borrowAndDeposit(borrowAmount);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        strategy.withdrawAndRepay(0);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InsufficientBalance.selector, address(dai), borrowAmount+1, borrowAmount-1));
        strategy.withdrawAndRepay(borrowAmount+1);
        
        vm.expectEmit(address(strategy));
        emit DaiWithdrawn(repayAmount);
        strategy.withdrawAndRepay(repayAmount);

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE-borrowAmount+repayAmount);
        assertApproxEqAbs(strategy.latestDaiBalance(), borrowAmount-repayAmount, 1); // Vault Rounding

        assertEq(dUSD.balanceOf(address(strategy)), borrowAmount-repayAmount);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        uint256 available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, BORROW_CEILING-borrowAmount+repayAmount);
    }  

    function test_withdrawAndRepayAll() public {   
        uint256 borrowAmount = 1e18;
        vm.startPrank(executor);
        strategy.borrowAndDeposit(borrowAmount);

        vm.expectEmit(address(strategy));
        emit DaiWithdrawn(borrowAmount-1);
        uint256 repayAmount = strategy.withdrawAndRepayAll();
        
        // Vault rounds on the way in, so we may not get the full amount back out.
        assertApproxEqAbs(borrowAmount, repayAmount, 1);

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE-1);
        assertEq(strategy.latestDaiBalance(), 0);

        // Vault rounds down, meaning we don't quite have enough DAI to payback the dUSD debt (dust is left)
        // In practice if withdrawing all, the strategy would be shutdown where all dUSD would be burned.
        // So this is fine.
        assertApproxEqAbs(dUSD.balanceOf(address(strategy)), 0, 1);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        uint256 available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertApproxEqAbs(available, BORROW_CEILING, 1);
        
        vm.expectRevert("Cannot withdraw 0");
        strategy.withdrawAndRepayAll();
    }

    function getRewards() internal {
        OrigamiSkyManager manager = origamiSkyVault.manager();
        uint32[] memory indexes = new uint32[](1);
        indexes[0] = 1;
        FarmDetails[] memory details = manager.farmDetails(indexes);
        uint256 skyRewards = details[0].unclaimedRewards;
        uint256 usdsRewards = skyRewards * 0.05e18 / 1e18;
        deal(address(usds), address(manager), usdsRewards, true);
    }

    function test_vaultEarning() public 
    {
        uint256 borrowAmount = 100e18;
        vm.startPrank(executor);
        trv.setStrategyDebtCeiling(address(strategy), dai, borrowAmount);
        deal(address(dai), address(trv), 100e18, true);

        vm.startPrank(executor);
        strategy.borrowAndDeposit(borrowAmount);

        ITempleStrategy.AssetBalance[] memory assetBalances1 = strategy.latestAssetBalances();

        // Move forward and check the increase.
        vm.warp(block.timestamp + 365 days);
        getRewards();
        (
            ITempleStrategy.AssetBalance[] memory assetBalances2, 
            ,
            ,
        ) = trv.strategyBalanceSheet(address(strategy));

        assertEq(assetBalances1.length, assetBalances2.length);
        assertEq(assetBalances1.length, 1);
        assertGt(assetBalances2[0].balance, assetBalances1[0].balance);
        assertGt(assetBalances2[0].balance, borrowAmount);
    }

    function test_checkpointBalances() public 
    {
        uint256 borrowAmount = 100e18;
        vm.startPrank(executor);
        trv.setStrategyDebtCeiling(address(strategy), dai, borrowAmount);
        deal(address(dai), address(trv), 100e18, true);

        vm.startPrank(executor);
        strategy.borrowAndDeposit(borrowAmount);

        // Move forward and check the increase.
        vm.warp(block.timestamp + 365 days);
        getRewards();
        ITempleStrategy.AssetBalance[] memory assetBalances1 = strategy.latestAssetBalances();

        // A checkpoint doesn't do anything - same function
        ITempleStrategy.AssetBalance[] memory assetBalances2 = strategy.checkpointAssetBalances();
        assertEq(assetBalances2[0].balance, assetBalances1[0].balance);
    }

    function test_automatedShutdown() public {
        uint256 borrowAmount = 1e18;
        vm.startPrank(executor);
        strategy.borrowAndDeposit(borrowAmount);

        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.NotShuttingDown.selector));
        strategy.automatedShutdown("");

        // Executor initiates the shutdown.
        {
            vm.startPrank(executor);
            trv.setStrategyIsShuttingDown(address(strategy), true);
            (,, bool isShuttingDown,) = trv.strategies(address(strategy));
            assertTrue(isShuttingDown);
            assertApproxEqAbs(strategy.latestDaiBalance(), borrowAmount, 1); // vault Rounding
            assertEq(dai.balanceOf(address(strategy)), 0);
            assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE-borrowAmount);
            assertEq(dUSD.balanceOf(address(strategy)), borrowAmount);
            
            uint256 available = trv.availableForStrategyToBorrow(address(strategy), dai);
            assertEq(available, BORROW_CEILING-borrowAmount);
        }

        // Do the shutdown
        {
            vm.startPrank(executor);

            vm.expectEmit(address(strategy));
            emit DaiWithdrawn(borrowAmount-1);

            vm.expectEmit(address(trv));
            emit Repay(address(strategy), address(dai), address(strategy), borrowAmount-1);

            // 1 wei rounding left over as debt
            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(strategy), address(dai), 0, 1);

            vm.expectEmit(address(strategy));
            emit Shutdown();

            // 1 wei rounding left over as debt
            vm.expectEmit(address(trv));
            emit StrategyShutdownCreditAndDebt(address(strategy), address(dai), 0, 1);

            vm.expectEmit(address(trv));
            emit StrategyRemoved(address(strategy));

            strategy.automatedShutdown("");

            (,, bool isShuttingDown,) = trv.strategies(address(strategy));
            assertFalse(isShuttingDown);
            assertEq(strategy.latestDaiBalance(), 0);
            assertEq(dai.balanceOf(address(strategy)), 0);
            assertApproxEqAbs(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE, 1);
            assertEq(dUSD.balanceOf(address(strategy)), 0);

            // Post shutdown, the strategy isn't enabled
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.StrategyNotEnabled.selector));
            trv.availableForStrategyToBorrow(address(strategy), dai);
        }
    }
}

contract SkyFarmBaseStrategyTestTrvWithdraw is SkyFarmBaseStrategyTestBase {
    GnosisStrategy public gnosisStrategy;
    address public gnosisSafeWallet = makeAddr("gnosis");
    uint256 public constant TRV_STARTING_BALANCE = 10e18;
    uint256 public constant DSR_BORROW_CEILING = 100e18;
    uint256 public constant GNOSIS_BORROW_CEILING = 25e18;

    TempleCircuitBreakerAllUsersPerPeriod public daiCircuitBreaker;
    TempleCircuitBreakerProxy public circuitBreakerProxy;
    bytes32 public constant INTERNAL_STRATEGY = keccak256("INTERNAL_STRATEGY");

    function setUp() public {
        _setUp();

        circuitBreakerProxy = new TempleCircuitBreakerProxy(rescuer, executor);
        gnosisStrategy = new GnosisStrategy(rescuer, executor, "GnosisStrategy", address(trv), gnosisSafeWallet, address(circuitBreakerProxy));

        vm.startPrank(executor);

        ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
        debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), DSR_BORROW_CEILING);
        trv.setBorrowToken(dai, address(strategy), 0, 0, address(dUSD));
        trv.addStrategy(address(strategy), -123, debtCeiling);

        deal(address(dai), address(trv), TRV_STARTING_BALANCE, true);
        dUSD.addMinter(address(trv));

        debtCeiling = new ITempleStrategy.AssetBalance[](1);
        debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), GNOSIS_BORROW_CEILING);
        trv.addStrategy(address(gnosisStrategy), -123, debtCeiling);

        // Circuit Breaker
        {
            daiCircuitBreaker = new TempleCircuitBreakerAllUsersPerPeriod(rescuer, executor, 26 hours, 13, 20_000_000e18);
            circuitBreakerProxy.setIdentifierForCaller(address(gnosisStrategy), "INTERNAL_STRATEGY");
            circuitBreakerProxy.setCircuitBreaker(INTERNAL_STRATEGY, address(dai), address(daiCircuitBreaker));
            setExplicitAccess(daiCircuitBreaker, address(circuitBreakerProxy), daiCircuitBreaker.preCheck.selector, true);
        }

        vm.stopPrank();
    }

    function test_trvDeposit() public {
        vm.startPrank(address(trv));
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        strategy.trvDeposit(0);

        vm.expectRevert("Dai/insufficient-balance");
        strategy.trvDeposit(100);

        uint256 amount = 1e18;
        deal(address(dai), address(strategy), amount, true);
        vm.expectEmit(address(strategy));
        emit DaiDeposited(amount);
        strategy.trvDeposit(amount);

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertApproxEqAbs(strategy.latestDaiBalance(), amount, 1);
    }

    function test_trvWithdraw_inIsoloation() public {   
        uint256 borrowAmount = 1e18;
        uint256 withdrawAmount = 0.25e18;
        vm.startPrank(executor);
        strategy.borrowAndDeposit(borrowAmount);

        vm.startPrank(address(trv));
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        strategy.trvWithdraw(0);

        vm.expectEmit(address(strategy));
        emit DaiWithdrawn(withdrawAmount);
        uint256 withdrawn = strategy.trvWithdraw(withdrawAmount);
        assertEq(withdrawn, withdrawAmount);

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE-borrowAmount+withdrawAmount);
        assertApproxEqAbs(strategy.latestDaiBalance(), borrowAmount-withdrawAmount, 1); // Vault Rounding

        assertEq(dUSD.balanceOf(address(strategy)), borrowAmount);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        uint256 available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertApproxEqAbs(available, DSR_BORROW_CEILING-borrowAmount, 1);
    }

    function test_trvWithdraw_capped() public {   
        uint256 borrowAmount = 1e18;
        uint256 withdrawAmount = 1.25e18;
        vm.startPrank(executor);
        strategy.borrowAndDeposit(borrowAmount);

        // Do a direct TRV withdraw, pranking the TRV.
        // Calling trvWithdraw directly doesn't burn the dUSD (this is done in the 'complex' test)
        vm.startPrank(address(trv));
        vm.expectEmit(address(strategy));
        emit DaiWithdrawn(borrowAmount - 1); // Vault Rounding
        uint256 withdrawn = strategy.trvWithdraw(withdrawAmount);

        assertEq(withdrawn, borrowAmount - 1); // Vault Rounding
        assertEq(dai.balanceOf(address(strategy)), 0);
        assertApproxEqAbs(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE, 1); // Vault Rounding
        assertEq(strategy.latestDaiBalance(), 0);

        // The TRV is responsible for wiping the debt, so for this test it remains.
        assertEq(dUSD.balanceOf(address(strategy)), borrowAmount);
        assertEq(dUSD.balanceOf(address(trv)), 0);
        assertApproxEqAbs(trv.totalAvailable(dai), TRV_STARTING_BALANCE, 1);
        
        uint256 available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertApproxEqAbs(available, DSR_BORROW_CEILING-borrowAmount, 1); 
    }

    function test_trvWithdraw_complex() public {
        // First fund the base strategy
        {
            vm.startPrank(executor);

            // Trying to borrow the max ceiling (100e18), but the TRV only has 10e18
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InsufficientBalance.selector, address(dai), DSR_BORROW_CEILING, 10e18));
            strategy.borrowAndDeposit(DSR_BORROW_CEILING);

            deal(address(dai), address(trv), DSR_BORROW_CEILING, true);
            strategy.borrowAndDeposit(DSR_BORROW_CEILING);
            assertApproxEqAbs(trv.totalAvailable(dai), DSR_BORROW_CEILING, 1);
        }

        // Check trv and DSR strategy balances
        {
            assertEq(dai.balanceOf(address(strategy)), 0);
            assertEq(dai.balanceOf(address(trv)), 0);
            assertApproxEqAbs(strategy.latestDaiBalance(), DSR_BORROW_CEILING, 1); // Vault Rounding
            assertApproxEqAbs(trv.totalAvailable(dai), DSR_BORROW_CEILING, 1);
            assertEq(dUSD.balanceOf(address(strategy)), DSR_BORROW_CEILING);
            assertEq(dUSD.balanceOf(address(trv)), 0);
        }

        // Check gnosis strategy balances
        {
            assertEq(dai.balanceOf(gnosisSafeWallet), 0);
            assertEq(dai.balanceOf(address(gnosisStrategy)), 0);
            assertEq(dUSD.balanceOf(address(gnosisStrategy)), 0);
        }

        // Check available to borrow
        {
            // base dsr strategy is zero now - it was max borrowed
            uint256 available = trv.availableForStrategyToBorrow(address(strategy), dai);
            assertEq(available, 0); 
            // gnosis strategy has full capacity.
            available = trv.availableForStrategyToBorrow(address(gnosisStrategy), dai);
            assertEq(available, GNOSIS_BORROW_CEILING); 
        }

        // Now have the gnosis strategy borrow some of it
        uint256 borrowAmount = 2e18;
        gnosisStrategy.borrow(dai, borrowAmount);

        // Check available to borrow
        {
            // It was zero, and now there's two freed up - it was paid down when
            // the gnosis strategy borrowed
            uint256 available = trv.availableForStrategyToBorrow(address(strategy), dai);
            assertEq(available, borrowAmount); 
            available = trv.availableForStrategyToBorrow(address(gnosisStrategy), dai);
            assertEq(available, GNOSIS_BORROW_CEILING-borrowAmount); 
        }

        // Check trv and DSR strategy balances
        {
            assertEq(dai.balanceOf(address(strategy)), 0);
            assertEq(dai.balanceOf(address(trv)), 0);
            assertApproxEqAbs(strategy.latestDaiBalance(), DSR_BORROW_CEILING-borrowAmount, 2); // Vault Rounding
            assertApproxEqAbs(trv.totalAvailable(dai), DSR_BORROW_CEILING-borrowAmount, 2);
            assertEq(dUSD.balanceOf(address(strategy)), DSR_BORROW_CEILING-borrowAmount);
            assertEq(dUSD.balanceOf(address(trv)), 0);
        }

        // Check gnosis strategy balances
        {
            assertEq(dai.balanceOf(gnosisSafeWallet), borrowAmount);
            assertEq(dai.balanceOf(address(gnosisStrategy)), 0);
            assertEq(dUSD.balanceOf(address(gnosisStrategy)), borrowAmount);
        }
    }
}

contract SkyFarmBaseStrategyTestMigrate is SkyFarmBaseStrategyTestBase {
    event Shutdown();
    event Repay(address indexed strategy, address indexed token, address indexed from, uint256 amount);
    event StrategyShutdownCreditAndDebt(address indexed strategy, address indexed token, uint256 outstandingCredit, uint256 outstandingDebt);
    event StrategyCreditAndDebtBalance(address indexed strategy, address indexed token, uint256 credit, uint256 debt);
    event StrategyRemoved(address indexed strategy);

    ITempleStrategy public constant oldStrategy = ITempleStrategy(0x8b9e20D9970Af54fbaFe64049174e24d6DE0C412);
    SkyFarmBaseStrategy public newStrategy;

    function setUp() public {
        _setUp();
        dUSD = TempleDebtToken(0xd018d5ecCe2Cd1c230F1719367C22DfE92c696ac);
        trv = TreasuryReservesVault(0xf359Bae7b6AD295724e798A3Ef6Fa5109919F399);
        executor = 0x94b62A27a2f23CBdc0220826a8452fB5055cF273;

        newStrategy = new SkyFarmBaseStrategy(
            oldStrategy.rescuer(), 
            oldStrategy.executor(),
            "SkyFarmBaseStrategy",
            address(oldStrategy.treasuryReservesVault()),
            address(origamiSkyVault),
            address(daiToUsds)
        );
    }

    function test_migrate() public {
        uint256 existingStrategyDaiBalance = 1_315.722358573360858134e18;
        uint256 existingDUsdBalance = 5_018.181202753375051593e18;

        (
            ,,,,,
            int256 underperformingEquityThreshold,
            ITempleStrategy.AssetBalance[] memory debtCeiling
        ) = trv.strategyDetails(address(oldStrategy));
        (
            ,
            uint256 baseStrategyWithdrawalBuffer,
            uint256 baseStrategyDepositThreshold,
            ITempleDebtToken dToken
        ) = trv.borrowTokens(dai);

        // Executor initiates the shutdown.
        {
            vm.startPrank(executor);
            trv.setStrategyIsShuttingDown(address(oldStrategy), true);
            (,, bool isShuttingDown,) = trv.strategies(address(oldStrategy));
            assertTrue(isShuttingDown);

            ITempleStrategy.AssetBalance[] memory assetBalances = oldStrategy.latestAssetBalances();

            assertEq(assetBalances[0].balance, existingStrategyDaiBalance);
            assertEq(dai.balanceOf(address(oldStrategy)), 0);
            assertEq(dai.balanceOf(address(trv)), 27_524.404728487392876533e18);
            assertEq(dUSD.balanceOf(address(oldStrategy)), existingDUsdBalance);
            
            uint256 available = trv.availableForStrategyToBorrow(address(oldStrategy), dai);
            assertEq(available, 29_994_981.818797246624948407e18);
        }

        // Do the shutdown
        {
            vm.startPrank(executor);

            vm.expectEmit(address(oldStrategy));
            emit DaiWithdrawn(existingStrategyDaiBalance);

            vm.expectEmit(address(trv));
            emit Repay(address(oldStrategy), address(dai), address(oldStrategy), existingStrategyDaiBalance);

            // 1 wei rounding left over as debt
            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(oldStrategy), address(dai), 0, existingDUsdBalance-existingStrategyDaiBalance);

            vm.expectEmit(address(oldStrategy));
            emit Shutdown();

            // 1 wei rounding left over as debt
            vm.expectEmit(address(trv));
            emit StrategyShutdownCreditAndDebt(address(oldStrategy), address(temple), 0, 0);
            vm.expectEmit(address(trv));
            emit StrategyShutdownCreditAndDebt(address(oldStrategy), address(dai), 0, existingDUsdBalance-existingStrategyDaiBalance-1);

            vm.expectEmit(address(trv));
            emit StrategyRemoved(address(oldStrategy));

            oldStrategy.automatedShutdown("");

            (,, bool isShuttingDown,) = trv.strategies(address(oldStrategy));
            assertFalse(isShuttingDown);

            ITempleStrategy.AssetBalance[] memory assetBalances = oldStrategy.latestAssetBalances();
            assertEq(assetBalances[0].balance, 0);

            assertEq(dai.balanceOf(address(oldStrategy)), 0);
            assertEq(dai.balanceOf(address(trv)), 28_840.127087060753734667e18);
            assertEq(dUSD.balanceOf(address(oldStrategy)), 0);

            // Post shutdown, the oldStrategy isn't enabled
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.StrategyNotEnabled.selector));
            trv.availableForStrategyToBorrow(address(oldStrategy), dai);
        }

        {
            trv.setBorrowToken(
                dai,
                address(newStrategy),
                baseStrategyWithdrawalBuffer,
                baseStrategyDepositThreshold,
                address(dToken)
            );

            trv.addStrategy(address(newStrategy), underperformingEquityThreshold, debtCeiling);
            newStrategy.proposeNewExecutor(trv.executor());
        }

        {
            uint256 borrowAmount = 123e18;
            newStrategy.acceptExecutor();
            newStrategy.borrowAndDeposit(borrowAmount);

            ITempleStrategy.AssetBalance[] memory assetBalances = newStrategy.latestAssetBalances();
            assertEq(assetBalances[0].balance, borrowAmount-1);

            assertEq(origamiSkyVault.balanceOf(address(newStrategy)), 122.687869117767520043e18);
            assertEq(dai.balanceOf(address(trv)), 28_717.127087060753734667e18);
            assertEq(dUSD.balanceOf(address(newStrategy)), borrowAmount);
        }
    }
}