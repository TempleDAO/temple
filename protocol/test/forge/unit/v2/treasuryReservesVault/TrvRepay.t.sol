pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TreasuryReservesVault, ITreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { MockBaseStrategy } from "../strategies/MockBaseStrategy.t.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";
import { TreasuryReservesVaultTestBase } from "./TrvBase.t.sol";
import { stdError } from "forge-std/StdError.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

/* solhint-disable func-name-mixedcase, contract-name-camelcase, not-rely-on-time */
contract TreasuryReservesVaultTestRepay is TreasuryReservesVaultTestBase {
    event Repay(address indexed strategy, address indexed token, address indexed from, uint256 amount);
    event StrategyCreditAndDebtBalance(address indexed strategy, address indexed token, uint256 credit, uint256 debt);

    function setUp() public {
        _setUp();
    }


    function test_repay_reverts_noDTokenDebts() public {
        // Borrow token needs to exist
        {
            vm.startPrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.BorrowTokenNotEnabled.selector));
            trv.repay(dai, 123, address(strategy));
            
            vm.startPrank(executor);
            trv.setBorrowToken(dai, address(0), 100, 101, address(dUSD));
        }

        // 0 amount
        {
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
            trv.repay(dai, 0, address(strategy));
        }

        // Global paused
        {
            vm.startPrank(executor);
            trv.setGlobalPaused(false, true);

            vm.startPrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.RepaysPaused.selector));
            trv.repay(dai, 5.0e18, address(strategy));

            vm.startPrank(executor);
            trv.setGlobalPaused(false, false);
        }

        // Strategy needs to exist
        {
            vm.startPrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.StrategyNotEnabled.selector));
            trv.repay(dai, 5e18, address(strategy));

            vm.startPrank(executor);
            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 5e18);
            trv.addStrategy(address(strategy), 100, debtCeiling);
        }

        // Strategy paused
        {
            trv.setStrategyPaused(address(strategy), false, true);

            vm.startPrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.RepaysPaused.selector));
            trv.repay(dai, 5e18, address(strategy));

            vm.startPrank(executor);
            trv.setStrategyPaused(address(strategy), false, false);
        }

        // assertEq(trv.availableForStrategyToBorrow(address(strategy), dai), 5e18);

        // Too much
        {
            vm.startPrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.DebtCeilingBreached.selector, 5e18, 5.01e18));
            trv.borrow(dai, 5.01e18, alice);
        }

        // Payee not funded with DAI
        {
            vm.startPrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, address(strategy), 0, 5e18));
            trv.repay(dai, 5e18, address(strategy));

            deal(address(dai), address(strategy), 10e18, true);
        }

        // Success
        vm.expectEmit(address(trv));
        emit Repay(address(strategy), address(dai), address(strategy), 5e18);
        trv.repay(dai, 5e18, address(strategy));

        // Is shutting down is ok for repays
        {
            vm.startPrank(executor);
            trv.setStrategyIsShuttingDown(address(strategy), true);

            vm.startPrank(address(strategy));
            vm.expectEmit(address(trv));
            emit Repay(address(strategy), address(dai), address(strategy), 2e18);
            trv.repay(dai, 2e18, address(strategy));

            vm.startPrank(executor);
            trv.setStrategyIsShuttingDown(address(strategy), false);
        }

        // DAI transferred to TRV, dToken credit given to strategy as it started with no debt
        assertEq(dai.balanceOf(address(strategy)), 10e18-7e18);
        assertEq(dai.balanceOf(address(trv)), 7e18);
        assertEq(trv.strategyTokenCredits(address(strategy), dai), 7e18);
        assertEq(dUSD.balanceOf(address(strategy)), 0);

        // disable the borrow token and it should now revert
        {
            deal(address(dai), address(trv), 10e18, true);
            vm.startPrank(address(strategy));
            trv.borrow(dai, 10e18, alice);

            vm.startPrank(executor);
            IERC20[] memory disableBorrowTokens = new IERC20[](1);
            disableBorrowTokens[0] = dai;
            trv.updateStrategyEnabledBorrowTokens(address(strategy), new IERC20[](0), disableBorrowTokens);

            vm.startPrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.BorrowTokenNotEnabled.selector));
            trv.repay(dai, 2e18, address(strategy));

            vm.startPrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.BorrowTokenNotEnabled.selector));
            trv.repayAll(dai, address(strategy));
        }
    }

    function test_repay_withDTokenDebts_noCreditLeft() public {
        // Setup the config
        {
            vm.startPrank(executor);
            trv.setBorrowToken(dai, address(0), 0, 0, address(dUSD));
            deal(address(dai), address(trv), 120e18, true);

            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 50e18);
            trv.addStrategy(address(strategy), -123, debtCeiling);
        }

        // Borrow some so there's a debt
        {
            vm.startPrank(address(strategy));
            trv.borrow(dai, 5e18, address(strategy));
        }

        // Fund alice so she can repay on behalf of the strategy
        {
            deal(address(dai), alice, 50e18, true);
            vm.startPrank(address(alice));
            dai.approve(address(trv), 50e18);
        }

        {
            vm.expectEmit(address(trv));
            emit Repay(address(strategy), address(dai), address(alice), 3e18);

            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(strategy), address(dai), 0, 5e18-3e18);

            trv.repay(dai, 3e18, address(strategy));
        }

        // DAI transferred to TRV, dToken credit given to strategy as it started with no debt
        assertEq(dai.balanceOf(address(strategy)), 5e18);
        assertEq(dai.balanceOf(address(trv)), 120e18 - 5e18 + 3e18);
        assertEq(dai.balanceOf(address(alice)), 50e18-3e18);
        assertEq(trv.strategyTokenCredits(address(strategy), dai), 0);
        assertEq(dUSD.balanceOf(address(strategy)), 5e18 - 3e18);
    }

    function test_repay_withDTokenDebts_someCreditLeft() public {
        // Setup the config
        {
            vm.startPrank(executor);
            trv.setBorrowToken(dai, address(0), 0, 0, address(dUSD));
            deal(address(dai), address(trv), 120e18, true);

            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 50e18);
            trv.addStrategy(address(strategy), -123, debtCeiling);
        }

        // Borrow some so there's a debt
        {
            vm.startPrank(address(strategy));
            trv.borrow(dai, 5e18, address(strategy));
        }

        // Fund alice so she can repay on behalf of the strategy
        {
            deal(address(dai), alice, 50e18, true);
            vm.startPrank(address(alice));
            dai.approve(address(trv), 50e18);
        }

        {
            vm.expectEmit(address(trv));
            emit Repay(address(strategy), address(dai), address(alice), 7e18);

            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(strategy), address(dai), 7e18 - 5e18, 0);

            trv.repay(dai, 7e18, address(strategy));
        }

        {
            assertEq(dai.balanceOf(address(strategy)), 5e18);
            assertEq(dai.balanceOf(address(trv)), 120e18 - 5e18 + 7e18);
            assertEq(dai.balanceOf(address(alice)), 50e18 - 7e18);
            assertEq(trv.strategyTokenCredits(address(strategy), dai), 7e18 - 5e18);
            assertEq(dUSD.balanceOf(address(strategy)), 0);
        }
    }

    function test_repay_withBaseStrategy_noSelfRepay() public {
        MockBaseStrategy baseStrategy = new MockBaseStrategy(rescuer, executor, "MockBaseStrategy", address(trv), address(dai));
        uint256 bufferThreshold = 0.75e18;

        // Setup the config
        {
            vm.startPrank(executor);
            trv.setBorrowToken(dai, address(baseStrategy), bufferThreshold, 3*bufferThreshold, address(dUSD));
            deal(address(dai), address(baseStrategy), 1_000e18, true);
            deal(address(dai), address(trv), 120e18, true);

            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 50e18);
            trv.addStrategy(address(baseStrategy), -123, debtCeiling);
        }

        // If done as the strategy then it just sends straight from TRV
        // (doesn't deposit back to itself)
        {
            vm.startPrank(address(baseStrategy));

            vm.expectEmit(address(trv));
            emit Repay(address(baseStrategy), address(dai), address(baseStrategy), 7e18);

            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(baseStrategy), address(dai), 7e18, 0);

            trv.repay(dai, 7e18, address(baseStrategy));
        }


        {
            assertEq(dai.balanceOf(address(baseStrategy)), 1_000e18 - 7e18);
            assertEq(dai.balanceOf(address(trv)), 120e18 + 7e18);
            
            assertEq(trv.availableForStrategyToBorrow(address(baseStrategy), dai), 50e18 + 7e18);
            assertEq(trv.strategyTokenCredits(address(baseStrategy), dai), 7e18);
            assertEq(dUSD.balanceOf(address(strategy)), 0);
        }
    }

    function test_repay_withBaseStrategy_underThreshold() public {
        MockBaseStrategy baseStrategy = new MockBaseStrategy(rescuer, executor, "MockBaseStrategy", address(trv), address(dai));
        uint256 bufferThreshold = 12.25e18;

        // Setup the config
        {
            vm.startPrank(executor);
            trv.setBorrowToken(dai, address(baseStrategy), bufferThreshold, 3*bufferThreshold, address(dUSD));

            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 50e18);
            trv.addStrategy(address(baseStrategy), -123, debtCeiling);
            trv.addStrategy(address(strategy), -123, debtCeiling);
        }

        // Fund alice so she can repay on behalf of the strategy
        {
            deal(address(dai), alice, 50e18, true);
            vm.startPrank(address(alice));
            dai.approve(address(trv), 50e18);
        }

        // Sent back to the TRV. Under the balance threshold so it remains in the TRV - not sent to 
        // the base strategy
        {
            vm.startPrank(address(alice));

            vm.expectEmit(address(trv));
            emit Repay(address(strategy), address(dai), alice, 7e18);

            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(strategy), address(dai), 7e18, 0);

            trv.repay(dai, 7e18, address(strategy));
        }

        {
            assertEq(dai.balanceOf(address(baseStrategy)), 0);
            assertEq(dai.balanceOf(address(trv)), 7e18);
            assertEq(dai.balanceOf(address(alice)), 50e18-7e18);
            
            assertEq(trv.availableForStrategyToBorrow(address(strategy), dai), 50e18 + 7e18);
            assertEq(trv.strategyTokenCredits(address(strategy), dai), 7e18);
            assertEq(dUSD.balanceOf(address(strategy)), 0);

            assertEq(trv.availableForStrategyToBorrow(address(baseStrategy), dai), 50e18);
            assertEq(trv.strategyTokenCredits(address(baseStrategy), dai), 0);
            assertEq(dUSD.balanceOf(address(baseStrategy)), 0);
        }
    }

    function test_repay_withBaseStrategy_under2xThreshold() public {
        MockBaseStrategy baseStrategy = new MockBaseStrategy(rescuer, executor, "MockBaseStrategy", address(trv), address(dai));
        uint256 bufferThreshold = 12.25e18;

        // Setup the config
        {
            vm.startPrank(executor);
            trv.setBorrowToken(dai, address(baseStrategy), bufferThreshold, 3*bufferThreshold, address(dUSD));

            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 50e18);
            trv.addStrategy(address(baseStrategy), -123, debtCeiling);
            trv.addStrategy(address(strategy), -123, debtCeiling);
        }

        // Fund alice so she can repay on behalf of the strategy
        {
            deal(address(dai), alice, 50e18, true);
            vm.startPrank(address(alice));
            dai.approve(address(trv), 50e18);
        }

        // Sent back to the TRV. Under the balance threshold so it remains in the TRV - not sent to 
        // the base strategy
        {
            vm.startPrank(address(alice));

            vm.expectEmit(address(trv));
            emit Repay(address(strategy), address(dai), alice, 15e18);

            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(strategy), address(dai), 15e18, 0);

            trv.repay(dai, 15e18, address(strategy));
        }

        {
            assertEq(dai.balanceOf(address(baseStrategy)), 0);
            assertEq(dai.balanceOf(address(trv)), 15e18);
            assertEq(dai.balanceOf(address(alice)), 50e18-15e18);
            
            assertEq(trv.availableForStrategyToBorrow(address(strategy), dai), 50e18 + 15e18);
            assertEq(trv.strategyTokenCredits(address(strategy), dai), 15e18);
            assertEq(dUSD.balanceOf(address(strategy)), 0);

            assertEq(trv.availableForStrategyToBorrow(address(baseStrategy), dai), 50e18);
            assertEq(trv.strategyTokenCredits(address(baseStrategy), dai), 0);
            assertEq(dUSD.balanceOf(address(baseStrategy)), 0);
        }
    }

    function test_repay_withBaseStrategy_overWithdrawalThreshold() public {
        MockBaseStrategy baseStrategy = new MockBaseStrategy(rescuer, executor, "MockBaseStrategy", address(trv), address(dai));
        uint256 bufferThreshold = 12.25e18;
        uint256 depositThreshold = 3*bufferThreshold;

        // Setup the config
        {
            vm.startPrank(executor);
            trv.setBorrowToken(dai, address(baseStrategy), bufferThreshold, depositThreshold, address(dUSD));

            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 50e18);
            trv.addStrategy(address(baseStrategy), -123, debtCeiling);
            trv.addStrategy(address(strategy), -123, debtCeiling);
        }

        // Fund alice so she can repay on behalf of the strategy
        {
            deal(address(dai), alice, 50e18, true);
            vm.startPrank(address(alice));
            dai.approve(address(trv), 50e18);
        }

        // Sent back to the TRV. Over the balance threshold so the base strategy is topped up.
        {
            vm.startPrank(address(alice));

            vm.expectEmit(address(trv));
            emit Repay(address(strategy), address(dai), alice, 40e18);

            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(strategy), address(dai), 40e18, 0);

            trv.repay(dai, 40e18, address(strategy));
        }

        {
            uint256 expectedDepositedInBase = 40e18-bufferThreshold;
            assertEq(dai.balanceOf(address(baseStrategy)), expectedDepositedInBase);
            assertEq(dai.balanceOf(address(trv)), bufferThreshold);
            assertEq(dai.balanceOf(address(alice)), 50e18-40e18);
            
            assertEq(trv.availableForStrategyToBorrow(address(strategy), dai), 50e18 + 40e18);
            assertEq(trv.strategyTokenCredits(address(strategy), dai), 40e18);
            assertEq(dUSD.balanceOf(address(strategy)), 0);

            assertEq(trv.availableForStrategyToBorrow(address(baseStrategy), dai), 50e18 - expectedDepositedInBase);
            assertEq(trv.strategyTokenCredits(address(baseStrategy), dai), 0);
            assertEq(dUSD.balanceOf(address(baseStrategy)), expectedDepositedInBase);
        }
    }

    function test_repay_overflow() public {
        vm.startPrank(executor);

        uint256 debtCeiling = type(uint256).max - 10e18;

        // Setup the strategy
        {
            trv.setBorrowToken(dai, address(0), 0, 0, address(dUSD));
            deal(address(dai), address(trv), 100e18, true);

            ITempleStrategy.AssetBalance[] memory debtCeilingArr = new ITempleStrategy.AssetBalance[](1);
            debtCeilingArr[0] = ITempleStrategy.AssetBalance(address(dai), debtCeiling);
            trv.addStrategy(address(strategy), 0, debtCeilingArr);
        }

        uint256 available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, debtCeiling);

        deal(address(dai), address(trv), 1000e18, true);
        available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, debtCeiling);

        // Borrow 25e18
        strategy.borrow(dai, 25e18);
        available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, debtCeiling-25e18);

        // Repay 35e18 --> 10e18 in credit
        deal(address(dai), address(strategy), 35e18, true);
        strategy.repay(dai, 35e18);
        available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, debtCeiling + 10e18);
        assertEq(available, type(uint256).max);

        // Repaying any more will overflow.
        deal(address(dai), address(strategy), 1, true);
        vm.expectRevert(stdError.arithmeticError);
        strategy.repay(dai, 1);
    }

    function test_repayAll() public {
        {
            vm.startPrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.BorrowTokenNotEnabled.selector));
            trv.repayAll(dai, address(strategy));

            vm.startPrank(executor);
            trv.setBorrowToken(dai, address(0), 0, 0, address(dUSD));
            deal(address(dai), address(trv), 120e18, true);
        }

        // Setup the config
        {
            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 50e18);
            trv.addStrategy(address(strategy), -123, debtCeiling);
        }
            
        // 0 amount
        {
            vm.startPrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
            trv.repayAll(dai, address(strategy));

            trv.borrow(dai, 5.0e18, alice);
        }

        {
            vm.startPrank(address(alice));
            dai.approve(address(trv), 5e18);

            vm.expectEmit(address(trv));
            emit Repay(address(strategy), address(dai), alice, 5e18);

            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(strategy), address(dai), 0, 0);

            trv.repayAll(dai, address(strategy));
        }

        {
            assertEq(trv.strategyTokenCredits(address(strategy), dai), 0);
            assertEq(trv.availableForStrategyToBorrow(address(strategy), dai), 50e18);

            assertEq(dai.balanceOf(address(trv)), 120e18);

            assertEq(dai.balanceOf(address(strategy)), 0);
            assertEq(dai.balanceOf(alice), 0);

            assertEq(dUSD.balanceOf(address(strategy)), 0);
        }
    }
}
