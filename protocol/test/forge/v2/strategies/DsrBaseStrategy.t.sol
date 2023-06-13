pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../../TempleTest.sol";
import { DsrBaseStrategy } from "contracts/v2/strategies/DsrBaseStrategy.sol";
import { GnosisStrategy } from "contracts/v2/strategies/GnosisStrategy.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { TempleDebtToken } from "contracts/v2/TempleDebtToken.sol";
import { ITreasuryReservesVault, TreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";
import { TreasuryPriceIndexOracle } from "contracts/v2/TreasuryPriceIndexOracle.sol";

import { IMakerDaoDaiJoinLike } from "contracts/interfaces/external/makerDao/IMakerDaoDaiJoinLike.sol";
import { IMakerDaoPotLike } from "contracts/interfaces/external/makerDao/IMakerDaoPotLike.sol";

/* solhint-disable func-name-mixedcase, not-rely-on-time */
contract DsrBaseStrategyTestBase is TempleTest {
    DsrBaseStrategy public strategy;

    FakeERC20 public temple = new FakeERC20("TEMPLE", "TEMPLE", address(0), 0);
    IERC20 public dai = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    IMakerDaoDaiJoinLike public daiJoin = IMakerDaoDaiJoinLike(0x9759A6Ac90977b93B58547b4A71c78317f391A28);
    IMakerDaoPotLike public pot = IMakerDaoPotLike(0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7);

    FakeERC20 public frax = new FakeERC20("FRAX", "FRAX", address(0), 0);
    FakeERC20 public usdc = new FakeERC20("USDC", "USDC", address(0), 0);

    // 1% APR, which is how DSR is calculated. 
    // Nb this is ln(1.01)
    uint256 public constant DEFAULT_BASE_INTEREST = 9950330853168083;
    TempleDebtToken public dUSD;
    TreasuryPriceIndexOracle public tpiOracle;
    TreasuryReservesVault public trv;

    address[] public reportedAssets = [address(dai), address(frax), address(0)];

    function _setUp() public {
        fork("mainnet", 16675385);

        dUSD = new TempleDebtToken("Temple Debt", "dUSD", rescuer, executor, DEFAULT_BASE_INTEREST);
        tpiOracle = new TreasuryPriceIndexOracle(rescuer, executor, 0.97e18, 0.1e18, 0);
        trv = new TreasuryReservesVault(rescuer, executor, address(temple), address(dai), address(dUSD), address(tpiOracle));
        strategy = new DsrBaseStrategy(rescuer, executor, "DsrBaseStrategy", address(trv), address(daiJoin), address(pot));

        vm.startPrank(executor);
        dUSD.addMinter(executor);
        vm.stopPrank();
    }

    function expectOnlyTrv() internal {
        vm.prank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(ITempleStrategy.OnlyTreasuryReserveVault.selector, unauthorizedUser));
    }
}

contract DsrBaseStrategyTestAdmin is DsrBaseStrategyTestBase {

    function setUp() public {
        _setUp();
    }

    function test_initalization() public {
        assertEq(strategy.executors(executor), true);
        assertEq(strategy.rescuers(rescuer), true);
        assertEq(strategy.apiVersion(), "1.0.0");
        assertEq(strategy.strategyName(), "DsrBaseStrategy");
        assertEq(strategy.strategyVersion(), "1.0.0");
        assertEq(address(strategy.treasuryReservesVault()), address(trv));
        assertEq(address(strategy.stableToken()), address(dai));
        assertEq(address(strategy.internalDebtToken()), address(dUSD));
        ITempleStrategy.AssetBalanceDelta[] memory adjs = strategy.manualAdjustments();
        assertEq(adjs.length, 0);

        assertEq(address(strategy.daiJoin()), address(daiJoin));
        assertEq(address(strategy.pot()), address(pot));
    }
}

contract DsrBaseStrategyTestAccess is DsrBaseStrategyTestBase {
    function setUp() public {
        _setUp();
    }

    function test_access_borrowAndDeposit() public {
        expectElevatedAccess();
        strategy.borrowAndDeposit(0);
    }

    function test_access_borrowAndDepositMax() public {
        expectElevatedAccess();
        strategy.borrowAndDepositMax();
    }

    function test_access_withdrawAndRepay() public {
        expectElevatedAccess();
        strategy.withdrawAndRepay(0);
    }

    function test_access_withdrawAndRepayAll() public {
        expectElevatedAccess();
        strategy.withdrawAndRepayAll();
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

contract DsrBaseStrategyTestBorrowAndRepay is DsrBaseStrategyTestBase {
    uint256 public constant TRV_STARTING_BALANCE = 10e18;
    uint256 public constant BORROW_CEILING = 1.01e18;

    event DaiDeposited(uint256 amount);
    event DaiWithdrawn(uint256 amount);
    event Shutdown(uint256 stablesRecovered);

    function setUp() public {
        _setUp();

        // Add the new strategy, and setup TRV such that it has stables 
        // to lend and issue dUSD.
        vm.startPrank(executor);
        trv.addNewStrategy(address(strategy), BORROW_CEILING, 0);
        deal(address(dai), address(trv), TRV_STARTING_BALANCE, true);
        dUSD.addMinter(address(trv));
        vm.stopPrank();
    }

    function test_borrowAndDeposit() public {       
        uint256 amount = 1e18;
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE);

        (uint256 debt, uint256 available, uint256 ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, 0);
        assertEq(available, BORROW_CEILING);
        assertEq(ceiling, BORROW_CEILING);

        vm.expectEmit();
        emit DaiDeposited(amount);

        vm.startPrank(executor);
        strategy.borrowAndDeposit(amount);

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE-amount);
        assertApproxEqAbs(strategy.latestDsrBalance(), amount, 1); // DSR Rounding

        assertEq(dUSD.balanceOf(address(strategy)), amount);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        (debt, available, ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, amount);
        assertEq(available, 0.01e18);
        assertEq(ceiling, BORROW_CEILING);

        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.DebtCeilingBreached.selector, 0.01e18, 0.02e18));
        strategy.borrowAndDeposit(0.02e18);
    }  

    function test_borrowAndDepositMax() public {       
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE);

        (uint256 debt, uint256 available, uint256 ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, 0);
        assertEq(available, BORROW_CEILING);
        assertEq(ceiling, BORROW_CEILING);

        vm.expectEmit();
        emit DaiDeposited(BORROW_CEILING);

        vm.startPrank(executor);
        uint256 borrowed = strategy.borrowAndDepositMax();

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE-borrowed);
        assertApproxEqAbs(strategy.latestDsrBalance(), borrowed, 1); // DSR Rounding

        assertEq(dUSD.balanceOf(address(strategy)), BORROW_CEILING);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        (debt, available, ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, BORROW_CEILING);
        assertEq(available, 0);
        assertEq(ceiling, BORROW_CEILING);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        strategy.borrowAndDepositMax();
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
        
        vm.expectEmit();
        emit DaiWithdrawn(repayAmount);
        strategy.withdrawAndRepay(repayAmount);

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE-borrowAmount+repayAmount);
        assertApproxEqAbs(strategy.latestDsrBalance(), borrowAmount-repayAmount, 1); // DSR Rounding

        assertEq(dUSD.balanceOf(address(strategy)), borrowAmount-repayAmount);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        (uint256 debt, uint256 available, uint256 ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, borrowAmount-repayAmount);
        assertEq(available, BORROW_CEILING-borrowAmount+repayAmount);
        assertEq(ceiling, BORROW_CEILING);
    }  

    function test_withdrawAndRepayAll() public {   
        uint256 borrowAmount = 1e18;
        vm.startPrank(executor);
        strategy.borrowAndDeposit(borrowAmount);

        vm.expectEmit();
        emit DaiWithdrawn(borrowAmount-1);
        uint256 repayAmount = strategy.withdrawAndRepayAll();
        
        // DAI DSR rounds on the way in, so we may not get the full amount back out.
        assertApproxEqAbs(borrowAmount, repayAmount, 1);

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE-1);
        assertEq(strategy.latestDsrBalance(), 0);

        // DSR rounds down, meaning we don't quite have enough DAI to payback the dUSD debt (dust is left)
        // In practice if withdrawing all, the strategy would be shutdown where all dUSD would be burned.
        // So this is fine.
        assertApproxEqAbs(dUSD.balanceOf(address(strategy)), 0, 1);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        (uint256 debt, uint256 available, uint256 ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, dUSD.balanceOf(address(strategy)));
        assertApproxEqAbs(available, BORROW_CEILING, 1);
        assertEq(ceiling, BORROW_CEILING);
        
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        strategy.withdrawAndRepayAll();
    }

    function test_dsrEarning() public 
    {
        uint256 borrowAmount = 100e18;
        vm.startPrank(executor);
        trv.setStrategyDebtCeiling(address(strategy), borrowAmount);
        deal(address(dai), address(trv), 100e18, true);

        changePrank(executor);
        strategy.borrowAndDeposit(borrowAmount);

        ITempleStrategy.AssetBalance[] memory assetBalances1 = strategy.latestAssetBalances();

        // Move forward and check the increase.
        vm.warp(block.timestamp + 365 days);
        (
            ITempleStrategy.AssetBalance[] memory assetBalances2, 
            , 
            uint256 debt2
        ) = strategy.balanceSheet();

        assertEq(assetBalances1.length, assetBalances2.length);
        assertEq(assetBalances1.length, 1);
        assertGt(assetBalances2[0].balance, assetBalances1[0].balance);
        assertGt(assetBalances2[0].balance, borrowAmount);

        // 0 equity (some rounding due to exp() diff), as the DSR balance equals the dUSD debt.
        // They are both accruing at 1% APR
        assertApproxEqAbs(assetBalances2[0].balance, debt2, 100);
    }

    function test_checkpointBalances() public 
    {
        uint256 borrowAmount = 100e18;
        vm.startPrank(executor);
        trv.setStrategyDebtCeiling(address(strategy), borrowAmount);
        deal(address(dai), address(trv), 100e18, true);

        changePrank(executor);
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
        uint256 repayAmount = strategy.automatedShutdown("");

        // Executor initiates the shutdown.
        {
            changePrank(executor);
            trv.setStrategyIsShuttingDown(address(strategy), true);
            (bool isEnabled,,, bool isShuttingDown,,) = trv.strategies(address(strategy));
            assertTrue(isEnabled);
            assertTrue(isShuttingDown);
            assertApproxEqAbs(strategy.latestDsrBalance(), borrowAmount, 1); // DSR Rounding
            assertEq(dai.balanceOf(address(strategy)), 0);
            assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE-borrowAmount);
            assertEq(dUSD.balanceOf(address(strategy)), borrowAmount);
            
            (uint256 debt, uint256 available, uint256 ceiling) = strategy.trvBorrowPosition();
            assertEq(debt, dUSD.balanceOf(address(strategy)));
            assertEq(available, BORROW_CEILING-borrowAmount);
            assertEq(ceiling, BORROW_CEILING);
        }

        // Do the shutdown
        {
            changePrank(executor);
            vm.expectEmit();
            emit Shutdown(borrowAmount-1);
            repayAmount = strategy.automatedShutdown("");
            assertApproxEqAbs(repayAmount, borrowAmount, 1);

            (bool isEnabled,,, bool isShuttingDown,,) = trv.strategies(address(strategy));
            assertFalse(isEnabled);
            assertFalse(isShuttingDown);
            assertEq(strategy.latestDsrBalance(), 0);
            assertEq(dai.balanceOf(address(strategy)), 0);
            assertApproxEqAbs(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE, 1);
            assertEq(dUSD.balanceOf(address(strategy)), 0);

             // Post shutdown, the debt ceiling is now 0
            (uint256 debt, uint256 available, uint256 ceiling) = strategy.trvBorrowPosition();
            assertEq(debt, dUSD.balanceOf(address(strategy)));
            assertEq(available, 0);
            assertEq(ceiling, 0);
        }
    }
}

contract DsrBaseStrategyTestTrvWithdraw is DsrBaseStrategyTestBase {
    GnosisStrategy public gnosisStrategy;
    address public gnosisSafeWallet = makeAddr("gnosis");
    uint256 public constant TRV_STARTING_BALANCE = 10e18;
    uint256 public constant BORROW_CEILING = 1000e18;

    event DaiWithdrawn(uint256 amount);

    function setUp() public {
        _setUp();

        gnosisStrategy = new GnosisStrategy(rescuer, executor, "GnosisStrategy", address(trv), gnosisSafeWallet);

        vm.startPrank(executor);
        trv.addNewStrategy(address(strategy), BORROW_CEILING, 0);
        trv.setBaseStrategy(address(strategy));
        deal(address(dai), address(trv), TRV_STARTING_BALANCE, true);
        dUSD.addMinter(address(trv));
        trv.addNewStrategy(address(gnosisStrategy), BORROW_CEILING, 0);
        vm.stopPrank();
    }

    function test_trvWithdraw_inIsoloation() public {   
        uint256 borrowAmount = 1e18;
        uint256 withdrawAmount = 0.25e18;
        vm.startPrank(executor);
        strategy.borrowAndDeposit(borrowAmount);

        changePrank(address(trv));
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        strategy.trvWithdraw(0);

        vm.expectEmit();
        emit DaiWithdrawn(withdrawAmount);
        uint256 withdrawn = strategy.trvWithdraw(withdrawAmount);
        assertEq(withdrawn, withdrawAmount); // DSR Rounding

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE-borrowAmount+withdrawAmount);
        assertApproxEqAbs(strategy.latestDsrBalance(), borrowAmount-withdrawAmount, 1); // DSR Rounding

        assertEq(dUSD.balanceOf(address(strategy)), borrowAmount);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        (uint256 debt, uint256 available, uint256 ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, dUSD.balanceOf(address(strategy)));
        assertApproxEqAbs(available, TRV_STARTING_BALANCE, 1);
        assertEq(ceiling, BORROW_CEILING);
    }

    function test_trvWithdraw_capped() public {   
        uint256 borrowAmount = 1e18;
        uint256 withdrawAmount = 1.25e18;
        vm.startPrank(executor);
        strategy.borrowAndDeposit(borrowAmount);

        changePrank(address(trv));

        vm.expectEmit();
        emit DaiWithdrawn(borrowAmount - 1); // DSR Rounding
        uint256 withdrawn = strategy.trvWithdraw(withdrawAmount);
        assertEq(withdrawn, borrowAmount - 1); // DSR Rounding

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertApproxEqAbs(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE, 1); // DSR Rounding
        assertEq(strategy.latestDsrBalance(), 0);

        // The TRV is responsible for wiping the debt, so for this test it remains.
        assertEq(dUSD.balanceOf(address(strategy)), borrowAmount);
        assertEq(dUSD.balanceOf(address(trv)), 0);
        assertApproxEqAbs(trv.totalAvailableStables(), TRV_STARTING_BALANCE, 1);
        
        (uint256 debt, uint256 available, uint256 ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, dUSD.balanceOf(address(strategy)));
        assertApproxEqAbs(available, TRV_STARTING_BALANCE, 1); 
        assertEq(ceiling, BORROW_CEILING);       
    }

    function test_trvWithdraw_complex() public {
        // First fund the base strategy
        {
            deal(address(dai), address(trv), TRV_STARTING_BALANCE, true);
            vm.startPrank(executor);
            strategy.borrowAndDepositMax();
            assertApproxEqAbs(trv.totalAvailableStables(), TRV_STARTING_BALANCE, 1);
        }

        // Check trv and DSR strategy balances
        {
            assertEq(dai.balanceOf(address(strategy)), 0);
            assertEq(dai.balanceOf(address(trv)), 0);
            assertApproxEqAbs(strategy.latestDsrBalance(), TRV_STARTING_BALANCE, 1); // DSR Rounding
            assertApproxEqAbs(trv.totalAvailableStables(), TRV_STARTING_BALANCE, 1);
            assertEq(dUSD.balanceOf(address(strategy)), TRV_STARTING_BALANCE);
            assertEq(dUSD.balanceOf(address(trv)), 0);
        }

        // Check gnosis strategy balances
        {
            assertEq(dai.balanceOf(gnosisSafeWallet), 0);
            assertEq(dai.balanceOf(address(gnosisStrategy)), 0);
            assertEq(dUSD.balanceOf(address(gnosisStrategy)), 0);
        }

        // Now have the gnosis strategy borrow some of it
        uint256 borrowAmount = 2e18;
        gnosisStrategy.borrow(borrowAmount);

        // Check trv and DSR strategy balances
        {
            assertEq(dai.balanceOf(address(strategy)), 0);
            assertEq(dai.balanceOf(address(trv)), 0);
            assertApproxEqAbs(strategy.latestDsrBalance(), TRV_STARTING_BALANCE-borrowAmount, 2); // DSR Rounding
            assertApproxEqAbs(trv.totalAvailableStables(), TRV_STARTING_BALANCE-borrowAmount, 2);
            assertEq(dUSD.balanceOf(address(strategy)), TRV_STARTING_BALANCE-borrowAmount);
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