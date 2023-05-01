pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../../TempleTest.sol";
import { DsrBaseStrategy } from "contracts/v2/strategies/DsrBaseStrategy.sol";
import { GnosisStrategy } from "contracts/v2/strategies/GnosisStrategy.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { TempleDebtToken } from "contracts/v2/TempleDebtToken.sol";
import { StrategyExecutors } from "contracts/v2/access/StrategyExecutors.sol";
import { ITreasuryReservesVault, TreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";

import { IMakerDaoDaiJoinLike } from "contracts/interfaces/external/makerDao/IMakerDaoDaiJoinLike.sol";
import { IMakerDaoPotLike } from "contracts/interfaces/external/makerDao/IMakerDaoPotLike.sol";

contract DsrBaseStrategyTestBase is TempleTest {
    DsrBaseStrategy public strategy;

    IERC20 public dai = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    IMakerDaoDaiJoinLike public daiJoin = IMakerDaoDaiJoinLike(0x9759A6Ac90977b93B58547b4A71c78317f391A28);
    IMakerDaoPotLike public pot = IMakerDaoPotLike(0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7);

    address public executor = makeAddr("executor");

    FakeERC20 public frax = new FakeERC20("FRAX", "FRAX", address(0), 0);
    FakeERC20 public usdc = new FakeERC20("USDC", "USDC", address(0), 0);

    // 1% APR, which is how DSR is calculated. 
    // Nb this is ln(1.01)
    uint256 public constant defaultBaseInterest = 9950330853168083;
    TempleDebtToken public dUSD;
    TreasuryReservesVault public trv;

    address[] public reportedAssets = [address(dai), address(frax), address(0)];

    function _setUp() public {
        fork("mainnet", 16675385);

        dUSD = new TempleDebtToken("Temple Debt", "dUSD", gov, defaultBaseInterest);
        trv = new TreasuryReservesVault(gov, address(dai), address(dUSD));
        strategy = new DsrBaseStrategy(gov, "DsrBaseStrategy", address(trv), address(daiJoin), address(pot));

        vm.startPrank(gov);
        dUSD.addMinter(gov);
        strategy.addStrategyExecutor(executor);
        vm.stopPrank();
    }

    function expectOnlyStrategyExecutors() internal {
        vm.prank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(StrategyExecutors.OnlyStrategyExecutors.selector, unauthorizedUser));
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
        assertEq(strategy.gov(), gov);
        assertEq(strategy.apiVersion(), "1.0.0");
        assertEq(strategy.strategyName(), "DsrBaseStrategy");
        assertEq(strategy.strategyVersion(), "1.0.0");
        assertEq(address(strategy.treasuryReservesVault()), address(trv));
        assertEq(address(strategy.stableToken()), address(dai));
        assertEq(address(strategy.internalDebtToken()), address(dUSD));
        assertEq(strategy.manualAssetBalanceDeltas(address(dai)), 0);
        assertEq(strategy.currentDebt(), 0);

        assertEq(address(strategy.daiJoin()), address(daiJoin));
        assertEq(address(strategy.pot()), address(pot));
    }
}

contract DsrBaseStrategyTestAccess is DsrBaseStrategyTestBase {
    function setUp() public {
        _setUp();
    }

    function test_access_borrowAndDeposit() public {
        expectOnlyStrategyExecutors();
        strategy.borrowAndDeposit(0);
    }

    function test_access_borrowAndDepositMax() public {
        expectOnlyStrategyExecutors();
        strategy.borrowAndDepositMax();
    }

    function test_access_withdrawAndRepay() public {
        expectOnlyStrategyExecutors();
        strategy.withdrawAndRepay(0);
    }

    function test_access_withdrawAndRepayAll() public {
        expectOnlyStrategyExecutors();
        strategy.withdrawAndRepayAll();
    }

    function test_access_trvWithdraw() public {
        expectOnlyTrv();
        strategy.trvWithdraw(0);
    }

    function test_access_automatedShutdown() public {
        expectOnlyStrategyExecutors();
        strategy.automatedShutdown();
    }
}

contract DsrBaseStrategyTestBorrowAndRepay is DsrBaseStrategyTestBase {
    uint256 public constant trvStartingBalance = 10e18;
    uint256 public constant borrowCeiling = 1.01e18;

    event DaiDeposited(uint256 amount);
    event DaiWithdrawn(uint256 amount);
    event Shutdown(uint256 stablesRecovered);

    function setUp() public {
        _setUp();

        // Add the new strategy, and setup TRV such that it has stables 
        // to lend and issue dUSD.
        vm.startPrank(gov);
        trv.addNewStrategy(address(strategy), borrowCeiling, 0);
        deal(address(dai), address(trv), trvStartingBalance, true);
        dUSD.addMinter(address(trv));
        vm.stopPrank();
    }

    function test_borrowAndDeposit() public {       
        uint256 amount = 1e18;
        assertEq(dai.balanceOf(address(trv)), trvStartingBalance);
        assertEq(strategy.availableToBorrow(), borrowCeiling);

        vm.expectEmit(true, true, true, true);
        emit DaiDeposited(amount);

        vm.startPrank(executor);
        strategy.borrowAndDeposit(amount);

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), trvStartingBalance-amount);
        assertApproxEqAbs(strategy.latestDsrBalance(), amount, 1); // DSR Rounding

        assertEq(dUSD.balanceOf(address(strategy)), amount);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        assertEq(strategy.availableToBorrow(), 0.01e18);

        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.DebtCeilingBreached.selector, 0.01e18, 0.02e18));
        strategy.borrowAndDeposit(0.02e18);
    }  

    function test_borrowAndDepositMax() public {       
        assertEq(dai.balanceOf(address(trv)), trvStartingBalance);
        assertEq(strategy.availableToBorrow(), borrowCeiling);

        vm.expectEmit(true, true, true, true);
        emit DaiDeposited(borrowCeiling);

        vm.startPrank(executor);
        uint256 borrowed = strategy.borrowAndDepositMax();

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), trvStartingBalance-borrowed);
        assertApproxEqAbs(strategy.latestDsrBalance(), borrowed, 1); // DSR Rounding

        assertEq(dUSD.balanceOf(address(strategy)), borrowCeiling);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        assertEq(strategy.availableToBorrow(), 0);

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
        
        vm.expectEmit(true, true, true, true);
        emit DaiWithdrawn(repayAmount);
        strategy.withdrawAndRepay(repayAmount);

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), trvStartingBalance-borrowAmount+repayAmount);
        assertApproxEqAbs(strategy.latestDsrBalance(), borrowAmount-repayAmount, 1); // DSR Rounding

        assertEq(dUSD.balanceOf(address(strategy)), borrowAmount-repayAmount);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        assertEq(strategy.availableToBorrow(), borrowCeiling-borrowAmount+repayAmount);
    }  

    function test_withdrawAndRepayAll() public {   
        uint256 borrowAmount = 1e18;
        vm.startPrank(executor);
        strategy.borrowAndDeposit(borrowAmount);

        vm.expectEmit(true, true, true, true);
        emit DaiWithdrawn(borrowAmount-1);
        uint256 repayAmount = strategy.withdrawAndRepayAll();
        
        // DAI DSR rounds on the way in, so we may not get the full amount back out.
        assertApproxEqAbs(borrowAmount, repayAmount, 1);

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), trvStartingBalance-1);
        assertEq(strategy.latestDsrBalance(), 0);

        // DSR rounds down, meaning we don't quite have enough DAI to payback the dUSD debt (dust is left)
        // In practice if withdrawing all, the strategy would be shutdown where all dUSD would be burned.
        // So this is fine.
        assertApproxEqAbs(dUSD.balanceOf(address(strategy)), 0, 1);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        assertApproxEqAbs(strategy.availableToBorrow(), borrowCeiling, 1);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        strategy.withdrawAndRepayAll();
    }

    function test_dsrEarning() public 
    {
        uint256 borrowAmount = 100e18;
        vm.startPrank(gov);
        trv.setStrategyDebtCeiling(address(strategy), borrowAmount);
        deal(address(dai), address(trv), 100e18, true);

        changePrank(executor);
        strategy.borrowAndDeposit(borrowAmount);

        (ITempleStrategy.AssetBalance[] memory assetBalances1,) = strategy.checkpointAssetBalances();

        // Move forward and checkpoint increase.
        vm.warp(block.timestamp + 365 days);
        (ITempleStrategy.AssetBalance[] memory assetBalances2, uint256 debt2) = strategy.checkpointAssetBalances();
        
        assertEq(assetBalances1.length, assetBalances2.length);
        assertEq(assetBalances1.length, 1);
        assertGt(assetBalances2[0].balance, assetBalances1[0].balance);
        assertGt(assetBalances2[0].balance, borrowAmount);

        // 0 equity (some rounding due to exp() diff), as the DSR balance equals the dUSD debt.
        // They are both accruing at 1% APR
        assertApproxEqAbs(assetBalances2[0].balance, debt2, 100);
    }

    function test_automatedShutdown() public {
        uint256 borrowAmount = 1e18;
        vm.startPrank(executor);
        strategy.borrowAndDeposit(borrowAmount);

        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.NotShuttingDown.selector));
        uint256 repayAmount = strategy.automatedShutdown();

        // Gov starts the shutdown.
        {
            changePrank(gov);
            trv.setStrategyIsShuttingDown(address(strategy), true);
            (bool isEnabled,,, bool isShuttingDown,,) = trv.strategies(address(strategy));
            assertTrue(isEnabled);
            assertTrue(isShuttingDown);
            assertApproxEqAbs(strategy.latestDsrBalance(), borrowAmount, 1); // DSR Rounding
            assertEq(dai.balanceOf(address(strategy)), 0);
            assertEq(dai.balanceOf(address(trv)), trvStartingBalance-borrowAmount);
            assertEq(dUSD.balanceOf(address(strategy)), borrowAmount);
            assertEq(strategy.availableToBorrow(), borrowCeiling-borrowAmount);
        }

        // Do the shutdown
        {
            changePrank(executor);
            vm.expectEmit(true, true, true, true);
            emit Shutdown(borrowAmount-1);
            repayAmount = strategy.automatedShutdown();
            assertApproxEqAbs(repayAmount, borrowAmount, 1);

            (bool isEnabled,,, bool isShuttingDown,,) = trv.strategies(address(strategy));
            assertFalse(isEnabled);
            assertFalse(isShuttingDown);
            assertEq(strategy.latestDsrBalance(), 0);
            assertEq(dai.balanceOf(address(strategy)), 0);
            assertApproxEqAbs(dai.balanceOf(address(trv)), trvStartingBalance, 1);
            assertEq(dUSD.balanceOf(address(strategy)), 0);
            assertEq(strategy.availableToBorrow(), 0);
        }
    }
}

contract DsrBaseStrategyTestTrvWithdraw is DsrBaseStrategyTestBase {
    GnosisStrategy public gnosisStrategy;
    address public gnosisSafeWallet = makeAddr("gnosis");
    uint256 public constant trvStartingBalance = 10e18;
    uint256 public constant borrowCeiling = 1000e18;

    event DaiWithdrawn(uint256 amount);

    function setUp() public {
        _setUp();

        gnosisStrategy = new GnosisStrategy(gov, "GnosisStrategy", address(trv), gnosisSafeWallet);

        vm.startPrank(gov);
        trv.addNewStrategy(address(strategy), borrowCeiling, 0);
        trv.setBaseStrategy(address(strategy));
        deal(address(dai), address(trv), trvStartingBalance, true);
        dUSD.addMinter(address(trv));
        trv.addNewStrategy(address(gnosisStrategy), borrowCeiling, 0);
        gnosisStrategy.addStrategyExecutor(executor);
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

        vm.expectEmit(true, true, true, true);
        emit DaiWithdrawn(withdrawAmount);
        uint256 withdrawn = strategy.trvWithdraw(withdrawAmount);
        assertEq(withdrawn, withdrawAmount); // DSR Rounding

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), trvStartingBalance-borrowAmount+withdrawAmount);
        assertApproxEqAbs(strategy.latestDsrBalance(), borrowAmount-withdrawAmount, 1); // DSR Rounding

        assertEq(dUSD.balanceOf(address(strategy)), borrowAmount);
        assertEq(dUSD.balanceOf(address(trv)), 0);
        assertApproxEqAbs(strategy.availableToBorrow(), trvStartingBalance, 1);
    }

    function test_trvWithdraw_capped() public {   
        uint256 borrowAmount = 1e18;
        uint256 withdrawAmount = 1.25e18;
        vm.startPrank(executor);
        strategy.borrowAndDeposit(borrowAmount);

        changePrank(address(trv));

        vm.expectEmit(true, true, true, true);
        emit DaiWithdrawn(borrowAmount - 1); // DSR Rounding
        uint256 withdrawn = strategy.trvWithdraw(withdrawAmount);
        assertEq(withdrawn, borrowAmount - 1); // DSR Rounding

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertApproxEqAbs(dai.balanceOf(address(trv)), trvStartingBalance, 1); // DSR Rounding
        assertEq(strategy.latestDsrBalance(), 0);

        // The TRV is responsible for wiping the debt, so for this test it remains.
        assertEq(dUSD.balanceOf(address(strategy)), borrowAmount);
        assertEq(dUSD.balanceOf(address(trv)), 0);
        assertApproxEqAbs(trv.totalAvailableStables(), trvStartingBalance, 1);
        assertApproxEqAbs(strategy.availableToBorrow(), trvStartingBalance, 1);
    }

    function test_trvWithdraw_complex() public {
        // First fund the base strategy
        {
            deal(address(dai), address(trv), trvStartingBalance, true);
            vm.startPrank(executor);
            strategy.borrowAndDepositMax();
            assertApproxEqAbs(trv.totalAvailableStables(), trvStartingBalance, 1);
        }

        // Check trv and DSR strategy balances
        {
            assertEq(dai.balanceOf(address(strategy)), 0);
            assertEq(dai.balanceOf(address(trv)), 0);
            assertApproxEqAbs(strategy.latestDsrBalance(), trvStartingBalance, 1); // DSR Rounding
            assertApproxEqAbs(trv.totalAvailableStables(), trvStartingBalance, 1);
            assertEq(dUSD.balanceOf(address(strategy)), trvStartingBalance);
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
            assertApproxEqAbs(strategy.latestDsrBalance(), trvStartingBalance-borrowAmount, 2); // DSR Rounding
            assertApproxEqAbs(trv.totalAvailableStables(), trvStartingBalance-borrowAmount, 2);
            assertEq(dUSD.balanceOf(address(strategy)), trvStartingBalance-borrowAmount);
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