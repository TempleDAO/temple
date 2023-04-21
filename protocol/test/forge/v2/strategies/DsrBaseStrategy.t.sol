pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../../TempleTest.sol";
import { DsrBaseStrategy } from "contracts/v2/strategies/DsrBaseStrategy.sol";

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

    uint256 public constant defaultBaseInterest = 0.01e18;
    TempleDebtToken public dUSD;
    TreasuryReservesVault public trv;

    address[] public reportedAssets = [address(dai), address(frax), address(0)];

    function _setUp() public {
        fork("mainnet", 16675385);

        dUSD = new TempleDebtToken("Temple Debt", "dUSD", gov, defaultBaseInterest);
        trv = new TreasuryReservesVault(gov, address(dai), address(dUSD));
        strategy = new DsrBaseStrategy(gov, "DsrBaseStrategy", address(trv), address(dai), address(dUSD), address(daiJoin), address(pot));

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

        assertEq(dUSD.balanceOf(address(strategy)), 0);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        assertEq(strategy.availableToBorrow(), borrowCeiling);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        strategy.withdrawAndRepayAll();
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
        strategy.trvWithdraw(withdrawAmount);

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), trvStartingBalance-borrowAmount+withdrawAmount);
        assertApproxEqAbs(strategy.latestDsrBalance(), borrowAmount-withdrawAmount, 1); // DSR Rounding

        assertEq(dUSD.balanceOf(address(strategy)), borrowAmount);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        assertEq(strategy.availableToBorrow(), borrowCeiling-borrowAmount);
    }

    function test_trvWithdraw_viaTrv() public {
        // @todo -- need another strategy to borrow.

        // uint256 borrowAmount = 1e18;
        // uint256 withdrawAmount = 0.25e18;
        // vm.startPrank(executor);
        // strategy.borrowAndDeposit(borrowAmount);

        // changePrank(address(trv));
        // vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        // strategy.trvWithdraw(0);

        // vm.expectEmit(true, true, true, true);
        // emit DaiWithdrawn(withdrawAmount);
        // strategy.trvWithdraw(withdrawAmount);

        // assertEq(dai.balanceOf(address(strategy)), 0);
        // assertEq(dai.balanceOf(address(trv)), trvStartingBalance-borrowAmount+withdrawAmount);
        // assertApproxEqAbs(strategy.latestDsrBalance(), borrowAmount-withdrawAmount, 1); // DSR Rounding

        // assertEq(dUSD.balanceOf(address(strategy)), borrowAmount);
        // assertEq(dUSD.balanceOf(address(trv)), 0);

        // assertEq(strategy.availableToBorrow(), borrowCeiling-borrowAmount+withdrawAmount);
    }

    function test_automatedShutdown() public {
        // @todo 
    }
}
