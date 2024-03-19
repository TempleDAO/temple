pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TreasuryReservesVault, ITreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";
import { TreasuryReservesVaultTestBase } from "./TrvBase.t.sol";

/* solhint-disable func-name-mixedcase, contract-name-camelcase, not-rely-on-time */
contract TreasuryReservesVaultTestShutdown is TreasuryReservesVaultTestBase {
    event StrategyIsShuttingDownSet(address indexed strategy, bool isShuttingDown);
    event StrategyShutdownCreditAndDebt(address indexed strategy, address indexed token, uint256 outstandingCredit, uint256 outstandingDebt);
    event StrategyRemoved(address indexed strategy);

    function setUp() public {
        _setUp();
    }

    function test_setStrategyIsShuttingDown() public {
        vm.startPrank(executor);
        
        // Strategy needs to exist
        {
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.StrategyNotEnabled.selector));
            trv.setStrategyIsShuttingDown(address(strategy), true);

            trv.setBorrowToken(dai, address(0), 0, 0, address(dUSD));
            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 500);
            trv.addStrategy(address(strategy), 100, debtCeiling);
        }

        vm.expectEmit(address(trv));
        emit StrategyIsShuttingDownSet(address(strategy), true);
        trv.setStrategyIsShuttingDown(address(strategy), true);

        (
            bool borrowPaused,
            bool repaysPaused,
            bool isShuttingDown,
            int256 underperformingEquityThreshold
        ) = trv.strategies(address(strategy));
        assertEq(borrowPaused, false);
        assertEq(repaysPaused, false);
        assertEq(isShuttingDown, true);
        assertEq(underperformingEquityThreshold, 100);
    }

    function test_shutdown_zeroBalance() public {
        vm.startPrank(executor);
        
        // Strategy needs to exist
        {
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.StrategyNotEnabled.selector));
            trv.shutdown(address(strategy));

            trv.setBorrowToken(dai, address(0), 0, 0, address(dUSD));
            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 500);
            trv.addStrategy(address(strategy), 100, debtCeiling);
        }
        
        // Strategy needs to be 'shutting down'
        {
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.NotShuttingDown.selector));
            trv.shutdown(address(strategy));

            trv.setStrategyIsShuttingDown(address(strategy), true);
        }

        // Add some borrow tokens to report
        {
            trv.setBorrowToken(dai, address(0), 100, 101, address(dUSD));
            trv.setBorrowToken(weth, address(0), 999, 1000, address(dETH));
        }

        // Do the shutdown
        {
            vm.expectEmit(address(trv));
            emit StrategyShutdownCreditAndDebt(address(strategy), address(dai), 0, 0);
            vm.expectEmit(address(trv));
            emit StrategyShutdownCreditAndDebt(address(strategy), address(weth), 0, 0);
            vm.expectEmit(address(trv));
            emit StrategyRemoved(address(strategy));
            trv.shutdown(address(strategy));
        }

        address[] memory strategiesList = trv.strategiesList();
        assertEq(strategiesList.length, 0);
        
        (
            bool borrowPaused,
            bool repaysPaused,
            bool isShuttingDown,
            int256 underperformingEquityThreshold
        ) = trv.strategies(address(strategy));
        assertEq(borrowPaused, false);
        assertEq(repaysPaused, false);
        assertEq(isShuttingDown, false);
        assertEq(underperformingEquityThreshold, 0);
    }

    function test_shutdown_withOutstandingDebt() public {
        vm.startPrank(executor);

        // Setup dai/weth to be borrowed
        {
            trv.setBorrowToken(dai, address(0), 100, 101, address(dUSD));
            trv.setBorrowToken(weth, address(0), 999, 1000, address(dETH));
            deal(address(dai), address(trv), 1e18, true);
            deal(address(weth), address(trv), 1e18, true);
        }

        // Setup the strategy and borrow some dai & weth so there's a debt
        {
            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](2);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 5e18);
            debtCeiling[1] = ITempleStrategy.AssetBalance(address(weth), 5e18);
            trv.addStrategy(address(strategy), 100, debtCeiling);

            strategy.borrow(dai, 1e18);
            strategy.borrow(weth, 0.5e18);
        }

        // Start the shutdown process
        {
            trv.setStrategyIsShuttingDown(address(strategy), true);
        }

        // Do the shutdown
        {
            vm.expectEmit(address(trv));
            emit StrategyShutdownCreditAndDebt(address(strategy), address(dai), 0, 1e18);
            vm.expectEmit(address(trv));
            emit StrategyShutdownCreditAndDebt(address(strategy), address(weth), 0, 0.5e18);
            vm.expectEmit(address(trv));
            emit StrategyRemoved(address(strategy));
            trv.shutdown(address(strategy));
        }

        // dTokens get burned
        assertEq(dUSD.balanceOf(address(strategy)), 0);
        assertEq(dUSD.totalSupply(), 0);
        assertEq(dETH.balanceOf(address(strategy)), 0);
        assertEq(dETH.totalSupply(), 0);

        address[] memory strategiesList = trv.strategiesList();
        assertEq(strategiesList.length, 0);
        
        (
            bool borrowPaused,
            bool repaysPaused,
            bool isShuttingDown,
            int256 underperformingEquityThreshold
        ) = trv.strategies(address(strategy));
        assertEq(borrowPaused, false);
        assertEq(repaysPaused, false);
        assertEq(isShuttingDown, false);
        assertEq(underperformingEquityThreshold, 0);
    }

    function test_shutdown_withOutstandingCredit() public {
        vm.startPrank(executor);

        // Setup dai/weth to be borrowed
        {
            trv.setBorrowToken(dai, address(0), 100, 101, address(dUSD));
            trv.setBorrowToken(weth, address(0), 999, 1000, address(dETH));
            deal(address(dai), address(trv), 1e18, true);
            deal(address(weth), address(trv), 1e18, true);
        }

        // Setup the strategy and borrow some dai & weth so there's a debt
        {
            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](2);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 5e18);
            debtCeiling[1] = ITempleStrategy.AssetBalance(address(weth), 5e18);
            trv.addStrategy(address(strategy), 100, debtCeiling);

            strategy.borrow(dai, 1e18);
            strategy.borrow(weth, 0.5e18);
        }

        // Start the shutdown process
        {
            trv.setStrategyIsShuttingDown(address(strategy), true);
        }

        // Strategy repays more than it's debt in ETH
        {
            deal(address(weth), address(strategy), 1.25e18, true);
            strategy.repay(weth, 1.25e18);
        }

        // Do the shutdown
        {
            vm.expectEmit(address(trv));
            emit StrategyShutdownCreditAndDebt(address(strategy), address(dai), 0, 1e18);
            vm.expectEmit(address(trv));
            emit StrategyShutdownCreditAndDebt(address(strategy), address(weth), 0.75e18, 0);
            vm.expectEmit(address(trv));
            emit StrategyRemoved(address(strategy));
            trv.shutdown(address(strategy));
        }

        // dTokens get burned
        assertEq(dUSD.balanceOf(address(strategy)), 0);
        assertEq(dUSD.totalSupply(), 0);
        assertEq(dETH.balanceOf(address(strategy)), 0);
        assertEq(dETH.totalSupply(), 0);

        address[] memory strategiesList = trv.strategiesList();
        assertEq(strategiesList.length, 0);
        
        (
            bool borrowPaused,
            bool repaysPaused,
            bool isShuttingDown,
            int256 underperformingEquityThreshold
        ) = trv.strategies(address(strategy));
        assertEq(borrowPaused, false);
        assertEq(repaysPaused, false);
        assertEq(isShuttingDown, false);
        assertEq(underperformingEquityThreshold, 0);
    }
}