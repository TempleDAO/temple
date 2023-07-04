pragma solidity 0.8.18;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TreasuryReservesVault, ITreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { MockBaseStrategy } from "../strategies/MockBaseStrategy.t.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";
import { TreasuryReservesVaultTestBase } from "./TrvBase.t.sol";

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
            
            changePrank(executor);
            trv.setBorrowToken(dai, address(0), 100, 101, address(dUSD));
        }

        // 0 amount
        {
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
            trv.repay(dai, 0, address(strategy));
        }

        // Global paused
        {
            changePrank(executor);
            trv.setGlobalPaused(false, true);

            changePrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.RepaysPaused.selector));
            trv.repay(dai, 5.0e18, address(strategy));

            changePrank(executor);
            trv.setGlobalPaused(false, false);
        }

        // Strategy needs to exist
        {
            changePrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.StrategyNotEnabled.selector));
            trv.repay(dai, 5e18, address(strategy));

            changePrank(executor);
            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 5e18);
            trv.addStrategy(address(strategy), 100, debtCeiling);
        }

        // Strategy paused
        {
            trv.setStrategyPaused(address(strategy), false, true);

            changePrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.RepaysPaused.selector));
            trv.repay(dai, 5e18, address(strategy));

            changePrank(executor);
            trv.setStrategyPaused(address(strategy), false, false);
        }

        // assertEq(trv.availableForStrategyToBorrow(address(strategy), dai), 5e18);

        // Too much
        {
            changePrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.DebtCeilingBreached.selector, 5e18, 5.01e18));
            trv.borrow(dai, 5.01e18, alice);
        }

        // Payee not funded with DAI
        {
            changePrank(address(strategy));
            vm.expectRevert("ERC20: transfer amount exceeds balance");
            trv.repay(dai, 5e18, address(strategy));

            deal(address(dai), address(strategy), 10e18, true);
        }

        // Success
        vm.expectEmit(address(trv));
        emit Repay(address(strategy), address(dai), address(strategy), 5e18);
        trv.repay(dai, 5e18, address(strategy));

        // Is shutting down is ok for repays
        {
            changePrank(executor);
            trv.setStrategyIsShuttingDown(address(strategy), true);

            changePrank(address(strategy));
            vm.expectEmit(address(trv));
            emit Repay(address(strategy), address(dai), address(strategy), 2e18);
            trv.repay(dai, 2e18, address(strategy));

            changePrank(executor);
            trv.setStrategyIsShuttingDown(address(strategy), false);
        }

        // DAI transferred to TRV, dToken credit given to strategy as it started with no debt
        assertEq(dai.balanceOf(address(strategy)), 10e18-7e18);
        assertEq(dai.balanceOf(address(trv)), 7e18);
        assertEq(trv.strategyTokenCredits(address(strategy), dai), 7e18);
        assertEq(dUSD.balanceOf(address(strategy)), 0);
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
            changePrank(address(strategy));
            trv.borrow(dai, 5e18, address(strategy));
        }

        // Fund alice so she can repay on behalf of the strategy
        {
            deal(address(dai), alice, 50e18, true);
            changePrank(address(alice));
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
            changePrank(address(strategy));
            trv.borrow(dai, 5e18, address(strategy));
        }

        // Fund alice so she can repay on behalf of the strategy
        {
            deal(address(dai), alice, 50e18, true);
            changePrank(address(alice));
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
            changePrank(address(baseStrategy));

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
            changePrank(address(alice));
            dai.approve(address(trv), 50e18);
        }

        // Sent back to the TRV. Under the balance threshold so it remains in the TRV - not sent to 
        // the base strategy
        {
            changePrank(address(alice));

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
            changePrank(address(alice));
            dai.approve(address(trv), 50e18);
        }

        // Sent back to the TRV. Under the balance threshold so it remains in the TRV - not sent to 
        // the base strategy
        {
            changePrank(address(alice));

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
            changePrank(address(alice));
            dai.approve(address(trv), 50e18);
        }

        // Sent back to the TRV. Over the balance threshold so the base strategy is topped up.
        {
            changePrank(address(alice));

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

    function test_repayAll() public {
        {
            vm.startPrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.BorrowTokenNotEnabled.selector));
            trv.repayAll(dai, address(strategy));

            changePrank(executor);
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
            changePrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
            trv.repayAll(dai, address(strategy));

            trv.borrow(dai, 5.0e18, alice);
        }

        {
            changePrank(address(alice));
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
