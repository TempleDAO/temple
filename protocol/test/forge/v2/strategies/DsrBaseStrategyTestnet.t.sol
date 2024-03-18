pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../../TempleTest.sol";
import { DsrBaseStrategyTestnet } from "contracts/fakes/v2/strategies/DsrBaseStrategyTestnet.sol";
import { GnosisStrategy } from "contracts/v2/strategies/GnosisStrategy.sol";

import { TempleDebtToken } from "contracts/v2/TempleDebtToken.sol";
import { ITreasuryReservesVault, TreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";
import { TreasuryPriceIndexOracle } from "contracts/v2/TreasuryPriceIndexOracle.sol";
import { TempleCircuitBreakerAllUsersPerPeriod } from "contracts/v2/circuitBreaker/TempleCircuitBreakerAllUsersPerPeriod.sol";
import { TempleCircuitBreakerProxy } from "contracts/v2/circuitBreaker/TempleCircuitBreakerProxy.sol";

import { ud } from "@prb/math/src/UD60x18.sol";

/* solhint-disable func-name-mixedcase, not-rely-on-time */
contract DsrBaseStrategyTestnetTestBase is TempleTest {
    DsrBaseStrategyTestnet public strategy;

    FakeERC20 public immutable temple = new FakeERC20("TEMPLE", "TEMPLE", address(0), 0);
    FakeERC20 public immutable dai = new FakeERC20("DAI", "DAI", address(0), 0);

    FakeERC20 public immutable frax = new FakeERC20("FRAX", "FRAX", address(0), 0);
    FakeERC20 public immutable usdc = new FakeERC20("USDC", "USDC", address(0), 0);

    uint256 dsr = 0.01e18; // 1%

    // 1% APR, which is how DSR is calculated as of block #16675385
    // dUSD is represented in APY (continuously compounded), so need to convert in order to match
    // Nb this is ln(1.01). See `test_dsr_interest_equivalence()` below
    uint96 public constant DEFAULT_BASE_INTEREST = 0.009950330853168072e18;
    TempleDebtToken public dUSD;
    TreasuryPriceIndexOracle public tpiOracle;
    TreasuryReservesVault public trv;

    address[] public reportedAssets;

    event DaiDeposited(uint256 amount);
    event DaiWithdrawn(uint256 amount);

    function _setUp() internal {
        reportedAssets = [address(dai), address(frax), address(0)];
        dUSD = new TempleDebtToken("Temple Debt", "dUSD", rescuer, executor, DEFAULT_BASE_INTEREST);
        tpiOracle = new TreasuryPriceIndexOracle(rescuer, executor, 0.97e18, 0.1e18, 0);
        trv = new TreasuryReservesVault(rescuer, executor, address(tpiOracle));
        strategy = new DsrBaseStrategyTestnet(rescuer, executor, "DsrBaseStrategy", address(trv), address(dai), 0.01e18);

        vm.startPrank(executor);
        dUSD.addMinter(executor);
        vm.stopPrank();
    }

    function expectOnlyTrv() internal {
        vm.prank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(ITempleStrategy.OnlyTreasuryReserveVault.selector, unauthorizedUser));
    }
}

contract DsrBaseStrategyTestnetTestAdmin is DsrBaseStrategyTestnetTestBase {

    function setUp() public {
        _setUp();
    }

    function test_dsr_interest_equivalence() public {
        uint256 dsrRate = 1.01e18;
        uint256 equivalentDusdRate = ud(dsrRate).ln().unwrap();
        assertEq(equivalentDusdRate, 0.009950330853168072e18);

        dsrRate = 1.0349e18;
        equivalentDusdRate = ud(dsrRate).ln().unwrap();
        assertEq(equivalentDusdRate, 0.034304803691990293e18);
    }

    function test_initalization() public {
        assertEq(strategy.executor(), executor);
        assertEq(strategy.rescuer(), rescuer);
        assertEq(strategy.apiVersion(), "1.0.0");
        assertEq(strategy.strategyName(), "DsrBaseStrategy");
        assertEq(strategy.strategyVersion(), "1.0.0");
        assertEq(address(strategy.treasuryReservesVault()), address(trv));
        assertEq(address(strategy.daiToken()), address(dai));
        ITempleStrategy.AssetBalanceDelta[] memory adjs = strategy.manualAdjustments();
        assertEq(adjs.length, 0);
    }

    function test_setTreasuryReservesVault() public {
        vm.startPrank(executor);
        TreasuryReservesVault trv2 = new TreasuryReservesVault(rescuer, executor, address(tpiOracle));
        strategy.setTreasuryReservesVault(address(trv2));
        assertEq(address(strategy.treasuryReservesVault()), address(trv2));

        assertEq(dai.allowance(address(strategy), address(trv)), 0);
        assertEq(dai.allowance(address(strategy), address(trv2)), type(uint256).max);
    }
}

contract DsrBaseStrategyTestnetTestAccess is DsrBaseStrategyTestnetTestBase {
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

contract DsrBaseStrategyTestnetTestBorrowAndRepay is DsrBaseStrategyTestnetTestBase {
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

        assertEq(dai.balanceOf(address(strategy)), amount);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE-amount);
        assertApproxEqAbs(strategy.latestDsrBalance(), amount, 1); // DSR Rounding

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

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InsufficientBalance.selector, address(dai), borrowAmount+1, borrowAmount));
        strategy.withdrawAndRepay(borrowAmount+1);
        
        vm.expectEmit(address(strategy));
        emit DaiWithdrawn(repayAmount);
        strategy.withdrawAndRepay(repayAmount);

        assertEq(dai.balanceOf(address(strategy)), borrowAmount-repayAmount);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE-borrowAmount+repayAmount);
        assertEq(strategy.latestDsrBalance(), borrowAmount-repayAmount);

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
        emit DaiWithdrawn(borrowAmount);
        uint256 repayAmount = strategy.withdrawAndRepayAll();
        
        assertEq(borrowAmount, repayAmount);

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE);
        assertEq(strategy.latestDsrBalance(), 0);

        // DSR rounds down, meaning we don't quite have enough DAI to payback the dUSD debt (dust is left)
        // In practice if withdrawing all, the strategy would be shutdown where all dUSD would be burned.
        // So this is fine.
        assertEq(dUSD.balanceOf(address(strategy)), 0);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        uint256 available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, BORROW_CEILING);
        
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        strategy.withdrawAndRepayAll();
    }

    function test_dsrEarning() public 
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
        (
            ITempleStrategy.AssetBalance[] memory assetBalances2, 
            ,
            ITempleStrategy.AssetBalance[] memory dTokenBalances
            ,
        ) = trv.strategyBalanceSheet(address(strategy));

        assertEq(assetBalances1.length, assetBalances2.length);
        assertEq(assetBalances1.length, 1);
        assertGt(assetBalances2[0].balance, assetBalances1[0].balance);
        assertGt(assetBalances2[0].balance, borrowAmount);

        // 0 equity (some rounding due to exp() model diff), as the DSR balance equals the dUSD debt.
        // They are both accruing at 1% APR
        assertApproxEqAbs(assetBalances2[0].balance, dTokenBalances[0].balance, 1200);
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
        ITempleStrategy.AssetBalance[] memory assetBalances1 = strategy.latestAssetBalances();

        // A checkpoint doesn't do anything - the balances are the same as we calculate the DSR maths
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
            assertEq(strategy.latestDsrBalance(), borrowAmount);
            assertEq(dai.balanceOf(address(strategy)), borrowAmount);
            assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE-borrowAmount);
            assertEq(dUSD.balanceOf(address(strategy)), borrowAmount);
            
            uint256 available = trv.availableForStrategyToBorrow(address(strategy), dai);
            assertEq(available, BORROW_CEILING-borrowAmount);
        }

        // Do the shutdown
        {
            vm.startPrank(executor);

            vm.expectEmit(address(strategy));
            emit DaiWithdrawn(borrowAmount);

            vm.expectEmit(address(trv));
            emit Repay(address(strategy), address(dai), address(strategy), borrowAmount);

            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(strategy), address(dai), 0, 0);

            vm.expectEmit(address(strategy));
            emit Shutdown();

            vm.expectEmit(address(trv));
            emit StrategyShutdownCreditAndDebt(address(strategy), address(dai), 0, 0);

            vm.expectEmit(address(trv));
            emit StrategyRemoved(address(strategy));

            strategy.automatedShutdown("");

            (,, bool isShuttingDown,) = trv.strategies(address(strategy));
            assertFalse(isShuttingDown);
            assertEq(strategy.latestDsrBalance(), 0);
            assertEq(dai.balanceOf(address(strategy)), 0);
            assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE);
            assertEq(dUSD.balanceOf(address(strategy)), 0);

            // Post shutdown, the strategy isn't enabled
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.StrategyNotEnabled.selector));
            trv.availableForStrategyToBorrow(address(strategy), dai);
        }
    }
}

contract DsrBaseStrategyTestnetTestTrvWithdraw is DsrBaseStrategyTestnetTestBase {
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

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAmount.selector, address(dai), 100));
        strategy.trvDeposit(100);

        uint256 amount = 1e18;
        deal(address(dai), address(strategy), amount, true);
        vm.expectEmit(address(strategy));
        emit DaiDeposited(amount);
        strategy.trvDeposit(amount);

        assertEq(dai.balanceOf(address(strategy)), amount);
        assertEq(strategy.latestDsrBalance(), amount);
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

        assertEq(dai.balanceOf(address(strategy)), borrowAmount-withdrawAmount);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE-borrowAmount+withdrawAmount);
        assertEq(strategy.latestDsrBalance(), borrowAmount-withdrawAmount);

        assertEq(dUSD.balanceOf(address(strategy)), borrowAmount);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        uint256 available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, DSR_BORROW_CEILING-borrowAmount);
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
        emit DaiWithdrawn(borrowAmount);
        uint256 withdrawn = strategy.trvWithdraw(withdrawAmount);

        assertEq(withdrawn, borrowAmount);
        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE);
        assertEq(strategy.latestDsrBalance(), 0);

        // The TRV is responsible for wiping the debt, so for this test it remains.
        assertEq(dUSD.balanceOf(address(strategy)), borrowAmount);
        assertEq(dUSD.balanceOf(address(trv)), 0);
        assertEq(trv.totalAvailable(dai), TRV_STARTING_BALANCE);
        
        uint256 available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, DSR_BORROW_CEILING-borrowAmount); 
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
            assertEq(trv.totalAvailable(dai), DSR_BORROW_CEILING);
        }

        // Check trv and DSR strategy balances
        {
            assertEq(dai.balanceOf(address(strategy)), DSR_BORROW_CEILING);
            assertEq(dai.balanceOf(address(trv)), 0);
            assertEq(strategy.latestDsrBalance(), DSR_BORROW_CEILING);
            assertEq(trv.totalAvailable(dai), DSR_BORROW_CEILING);
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
            assertEq(dai.balanceOf(address(strategy)), DSR_BORROW_CEILING-borrowAmount);
            assertEq(dai.balanceOf(address(trv)), 0);
            assertEq(strategy.latestDsrBalance(), DSR_BORROW_CEILING-borrowAmount);
            assertEq(trv.totalAvailable(dai), DSR_BORROW_CEILING-borrowAmount);
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