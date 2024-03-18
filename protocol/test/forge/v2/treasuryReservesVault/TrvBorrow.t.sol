pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TreasuryReservesVault, ITreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { MockBaseStrategy } from "../strategies/MockBaseStrategy.t.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";
import { TreasuryReservesVaultTestBase } from "./TrvBase.t.sol";
import { stdError } from "forge-std/StdError.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/* solhint-disable func-name-mixedcase, contract-name-camelcase, not-rely-on-time */
contract TreasuryReservesVaultTestBorrow is TreasuryReservesVaultTestBase {
    event Borrow(address indexed strategy, address indexed token, address indexed recipient, uint256 amount);
    event StrategyCreditAndDebtBalance(address indexed strategy, address indexed token, uint256 credit, uint256 debt);

    uint256 internal constant DAI_CEILING = 333e18;
    uint256 internal constant TEMPLE_CEILING = 66e18;
    uint256 internal constant WETH_CEILING = 99e18;

    function setUp() public {
        _setUp();
    }

    function test_borrow_reverts() public {
        // Borrow token needs to exist
        {
            vm.startPrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.BorrowTokenNotEnabled.selector));
            trv.borrow(dai, 123, alice);
            
            vm.startPrank(executor);
            trv.setBorrowToken(dai, address(0), 100, 101, address(dUSD));
        }

        // Strategy needs to exist
        {
            vm.startPrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.StrategyNotEnabled.selector));
            trv.borrow(dai, 123, alice);

            vm.startPrank(executor);
            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 5e18);
            trv.addStrategy(address(strategy), 100, debtCeiling);
        }

        assertEq(trv.availableForStrategyToBorrow(address(strategy), dai), 5e18);

        // Too much
        {
            vm.startPrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.DebtCeilingBreached.selector, 5e18, 5.01e18));
            trv.borrow(dai, 5.01e18, alice);
        }

        // 0 amount
        {
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
            trv.borrow(dai, 0, alice);
        }

        // Global paused
        {
            vm.startPrank(executor);
            trv.setGlobalPaused(true, false);

            vm.startPrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.BorrowPaused.selector));
            trv.borrow(dai, 5.0e18, alice);

            vm.startPrank(executor);
            trv.setGlobalPaused(false, false);
        }

        // Strategy paused
        {
            trv.setStrategyPaused(address(strategy), true, false);

            vm.startPrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.BorrowPaused.selector));
            trv.borrow(dai, 5.0e18, alice);

            vm.startPrank(executor);
            trv.setStrategyPaused(address(strategy), false, false);
        }

        // Is shutting down
        {
            trv.setStrategyIsShuttingDown(address(strategy), true);

            vm.startPrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.StrategyIsShutdown.selector));
            trv.borrow(dai, 5.0e18, alice);

            vm.startPrank(executor);
            trv.setStrategyIsShuttingDown(address(strategy), false);
        }

        // TRV not funded with DAI
        {
            vm.startPrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InsufficientBalance.selector, address(dai), 5.0e18, 0));

            trv.borrow(dai, 5.0e18, alice);

            deal(address(dai), address(trv), 1_000e18, true);
        }

        // Success
        vm.expectEmit(address(trv));
        emit Borrow(address(strategy), address(dai), alice, 5e18);
        trv.borrow(dai, 5e18, alice);

        // DAI transferred to alice, dUSD minted to strategy.
        assertEq(dai.balanceOf(alice), 5e18);
        assertEq(dUSD.balanceOf(address(strategy)), 5e18);

        // disable the borrow token and it should now revert
        {
            vm.startPrank(executor);
            IERC20[] memory disableBorrowTokens = new IERC20[](1);
            disableBorrowTokens[0] = dai;
            trv.updateStrategyEnabledBorrowTokens(address(strategy), new IERC20[](0), disableBorrowTokens);

            vm.startPrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.BorrowTokenNotEnabled.selector));
            trv.borrow(dai, 5e18, alice);

            vm.startPrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.BorrowTokenNotEnabled.selector));
            trv.borrowMax(dai, alice);
        }
    }

    function test_borrow_fromCredits() public {
        // Setup the config
        {
            vm.startPrank(executor);
            trv.setBorrowToken(dai, address(0), 1_000e18, 2_000e18, address(dUSD));
            deal(address(dai), address(trv), 1_000e18, true);

            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), DAI_CEILING);
            trv.addStrategy(address(strategy), -123, debtCeiling);
        }

        // Do a repay such that there's a credit balance.
        {
            deal(address(dai), address(alice), 3e18, true);
            vm.startPrank(alice);
            dai.approve(address(trv), 3e18);

            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(strategy), address(dai), 3e18, 0);
            
            trv.repay(dai, 3e18, address(strategy));
            assertEq(trv.strategyTokenCredits(address(strategy), dai), 3e18);
            assertEq(trv.availableForStrategyToBorrow(address(strategy), dai), DAI_CEILING + 3e18);

            assertEq(dai.balanceOf(alice), 0);
            assertEq(dUSD.balanceOf(address(strategy)), 0);
        }

        // Taken from credits (still some left)
        {
            vm.startPrank(address(strategy));

            vm.expectEmit(address(trv));
            emit Borrow(address(strategy), address(dai), alice, 2e18);
            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(strategy), address(dai), 1e18, 0);

            trv.borrow(dai, 2e18, alice);
            assertEq(trv.strategyTokenCredits(address(strategy), dai), 1e18);
            assertEq(trv.availableForStrategyToBorrow(address(strategy), dai), DAI_CEILING + 1e18);

            assertEq(dai.balanceOf(alice), 2e18);
            assertEq(dUSD.balanceOf(address(strategy)), 0);
        }

        // Taken from credits and issue debt
        {
            vm.startPrank(address(strategy));

            vm.expectEmit(address(trv));
            emit Borrow(address(strategy), address(dai), alice, 5e18);
            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(strategy), address(dai), 0, 4e18);

            trv.borrow(dai, 5e18, alice);
            assertEq(trv.strategyTokenCredits(address(strategy), dai), 0);
            assertEq(trv.availableForStrategyToBorrow(address(strategy), dai), DAI_CEILING - 4e18);
            
            assertEq(dai.balanceOf(alice), 7e18);
            assertEq(dUSD.balanceOf(address(strategy)), 4e18);
        }
    }

    function test_borrow_withBaseStrategy_noSelfBorrow() public {
        MockBaseStrategy baseStrategy = new MockBaseStrategy(rescuer, executor, "MockBaseStrategy", address(trv), address(dai));
        uint256 bufferThreshold = 0.75e18;

        // Setup the config
        {
            vm.startPrank(executor);
            trv.setBorrowToken(dai, address(baseStrategy), bufferThreshold, 3*bufferThreshold, address(dUSD));
            deal(address(dai), address(baseStrategy), 1_000e18, true);
            deal(address(dai), address(trv), 1_000e18, true);

            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), DAI_CEILING);
            trv.addStrategy(address(baseStrategy), -123, debtCeiling);
        }

        // If done as the strategy then it just pulls straight from TRV
        // (doesn't pull from itself again)
        {
            vm.startPrank(address(baseStrategy));

            vm.expectEmit(address(trv));
            emit Borrow(address(baseStrategy), address(dai), alice, 5e18);
            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(baseStrategy), address(dai), 0, 5e18);

            trv.borrow(dai, 5e18, alice);
            assertEq(trv.strategyTokenCredits(address(baseStrategy), dai), 0);
            assertEq(trv.availableForStrategyToBorrow(address(baseStrategy), dai), DAI_CEILING - 5e18);

            assertEq(dai.balanceOf(alice), 5e18);
            assertEq(dUSD.balanceOf(address(baseStrategy)), 5e18);
        }
    }

    function test_borrow_withBaseStrategy_noBaseStrategy() public {
        // Setup the config
        {
            vm.startPrank(executor);
            trv.setBorrowToken(dai, address(0), 0.75e18, 3*0.75e18, address(dUSD));
            deal(address(dai), address(trv), 1_000e18, true);

            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), DAI_CEILING);
            trv.addStrategy(address(strategy), -123, debtCeiling);
        }

        // Pulled straight from the TRV as there's no base strategy set
        {
            vm.startPrank(address(strategy));

            vm.expectEmit(address(trv));
            emit Borrow(address(strategy), address(dai), alice, 5e18);

            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(strategy), address(dai), 0, 5e18);

            trv.borrow(dai, 5e18, alice);
        }

        {
            assertEq(trv.strategyTokenCredits(address(strategy), dai), 0);
            assertEq(trv.availableForStrategyToBorrow(address(strategy), dai), DAI_CEILING - 5e18);

            assertEq(dai.balanceOf(address(trv)), 1_000e18-5e18);
            assertEq(dai.balanceOf(address(strategy)), 0);
            assertEq(dai.balanceOf(alice), 5e18);

            assertEq(dUSD.balanceOf(address(strategy)), 5e18);
        }
    }

    function test_borrow_withBaseStrategy_allTrvBalance_outstandingBaseStrategyDebt() public {
        MockBaseStrategy baseStrategy = new MockBaseStrategy(rescuer, executor, "MockBaseStrategy", address(trv), address(dai));
        uint256 bufferThreshold = 0;
        uint256 baseStrategyFunding = 200e18;

        // Setup the config
        {
            vm.startPrank(executor);
            trv.setBorrowToken(dai, address(baseStrategy), bufferThreshold, 3*bufferThreshold, address(dUSD));

            deal(address(dai), address(trv), baseStrategyFunding+2e18, true);

            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), DAI_CEILING);
            trv.addStrategy(address(baseStrategy), -123, debtCeiling);
            trv.addStrategy(address(strategy), -123, debtCeiling);

            // The base strategy now has a dUSD debt of 200e18
            baseStrategy.borrowAndDeposit(150e18);
        }

        {
            vm.startPrank(address(strategy));

            vm.expectEmit(address(trv));
            emit Borrow(address(strategy), address(dai), alice, 5e18);

            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(strategy), address(dai), 0, 5e18);

            trv.borrow(dai, 5e18, alice);
        }

        {
            assertEq(trv.strategyTokenCredits(address(strategy), dai), 0);
            assertEq(trv.availableForStrategyToBorrow(address(strategy), dai), DAI_CEILING - 5e18);

            // 2 was taken from the TRV which started at 52 (200-150+2)
            assertEq(dai.balanceOf(address(trv)), 50e18 + 2e18 - 5e18);
            // Nothing was taken out of the base strategy
            assertEq(dai.balanceOf(address(baseStrategy)), 150e18);

            assertEq(dai.balanceOf(address(strategy)), 0);
            assertEq(dai.balanceOf(alice), 5e18);

            assertEq(dUSD.balanceOf(address(strategy)), 5e18);
            assertEq(trv.strategyTokenCredits(address(baseStrategy), dai), 0);
            assertEq(dUSD.balanceOf(address(baseStrategy)), 150e18);
        }
    }

    function test_borrow_withBaseStrategy_useTrvBalanceFirst_outstandingBaseStrategyDebt() public {
        MockBaseStrategy baseStrategy = new MockBaseStrategy(rescuer, executor, "MockBaseStrategy", address(trv), address(dai));
        uint256 bufferThreshold = 0;
        uint256 baseStrategyFunding = 200e18;

        // Setup the config
        {
            vm.startPrank(executor);
            trv.setBorrowToken(dai, address(baseStrategy), bufferThreshold, 3*bufferThreshold, address(dUSD));

            deal(address(dai), address(trv), baseStrategyFunding+2e18, true);

            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), DAI_CEILING);
            trv.addStrategy(address(baseStrategy), -123, debtCeiling);
            trv.addStrategy(address(strategy), -123, debtCeiling);

            // The base strategy now has a dUSD debt of 200e18
            baseStrategy.borrowAndDeposit(baseStrategyFunding);
        }

        {
            vm.startPrank(address(strategy));

            vm.expectEmit(address(trv));
            emit Borrow(address(strategy), address(dai), alice, 5e18);

            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(strategy), address(dai), 0, 5e18);

            // The base strategy had a repayment of (5-2)
            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(baseStrategy), address(dai), 0, baseStrategyFunding - 5e18 + 2e18);

            trv.borrow(dai, 5e18, alice);
        }

        {
            assertEq(trv.strategyTokenCredits(address(strategy), dai), 0);
            assertEq(trv.availableForStrategyToBorrow(address(strategy), dai), DAI_CEILING - 5e18);

            // 2 was taken from the TRV -- now empty
            assertEq(dai.balanceOf(address(trv)), 0);
            // only 3 was taken out of the base strategy
            assertEq(dai.balanceOf(address(baseStrategy)), baseStrategyFunding - 5e18 + 2e18);

            assertEq(dai.balanceOf(address(strategy)), 0);
            assertEq(dai.balanceOf(alice), 5e18);

            assertEq(dUSD.balanceOf(address(strategy)), 5e18);
            assertEq(trv.strategyTokenCredits(address(baseStrategy), dai), 0);
            assertEq(dUSD.balanceOf(address(baseStrategy)), baseStrategyFunding - 5e18 + 2e18);
        }
    }

    function test_borrow_withBaseStrategy_trvWithdraw_someBuffer_baseStrategyDebtRepaid() public {
        MockBaseStrategy baseStrategy = new MockBaseStrategy(rescuer, executor, "MockBaseStrategy", address(trv), address(dai));
        uint256 bufferThreshold = 7.75e18;
        uint256 baseStrategyFunding = 1.123e18;

        // Setup the config
        {
            vm.startPrank(executor);
            trv.setBorrowToken(dai, address(baseStrategy), bufferThreshold, 3*bufferThreshold, address(dUSD));

            deal(address(dai), address(baseStrategy), 1_000e18, true);
            deal(address(dai), address(trv), 0.5e18 + baseStrategyFunding, true);

            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), DAI_CEILING);
            trv.addStrategy(address(baseStrategy), -123, debtCeiling);
            trv.addStrategy(address(strategy), -123, debtCeiling);

            // The base strategy now has a dUSD debt of 1.123e18
            baseStrategy.borrowAndDeposit(baseStrategyFunding);
        }

        {
            vm.startPrank(address(strategy));

            vm.expectEmit(address(trv));
            emit Borrow(address(strategy), address(dai), alice, 5e18);

            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(strategy), address(dai), 0, 5e18);

            // The TRV started with 0.5 + 1.123 DAI.
            // The base strategy borrowed and deposited 1.123 of this (so a dUSD of 1.123)
            // The new borrow of 5 meant:
            //     1.623 directly from TRV
            //     (7.75+5-1.623 = 11.127) was pulled from the base strategy (so the buffer was back to 7.75)
            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(baseStrategy), address(dai), 5e18+bufferThreshold-0.5e18-baseStrategyFunding, 0);

            trv.borrow(dai, 5e18, alice);
        }

        {
            assertEq(trv.strategyTokenCredits(address(strategy), dai), 0);
            assertEq(trv.availableForStrategyToBorrow(address(strategy), dai), DAI_CEILING - 5e18);

            // The TRV now has exactly the threshold of DAI.
            assertEq(dai.balanceOf(address(trv)), bufferThreshold, "trv");
            // The threshold amount (7.75e18) plus anything not covered by the TRV initially was taken out of the base strategy
            assertEq(dai.balanceOf(address(baseStrategy)), 1_000e18 - (bufferThreshold + 5e18 - baseStrategyFunding - 0.5e18), "baseStrategy");

            assertEq(dai.balanceOf(address(strategy)), 0, "strategy");
            assertEq(dai.balanceOf(alice), 5e18, "alice");

            assertEq(dUSD.balanceOf(address(strategy)), 5e18, "dusd");
            assertEq(trv.strategyTokenCredits(address(baseStrategy), dai), 5e18+bufferThreshold-0.5e18-baseStrategyFunding);
            assertEq(dUSD.balanceOf(address(baseStrategy)), 0, "dusd");
        }
    }

    function test_borrowMax() public {
        {
            vm.startPrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.BorrowTokenNotEnabled.selector));
            trv.borrowMax(dai, alice);

            vm.startPrank(executor);
            trv.setBorrowToken(dai, address(0), 0, 0, address(dUSD));
            deal(address(dai), address(trv), 120e18, true);
        }

        {
            vm.startPrank(address(strategy));
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.StrategyNotEnabled.selector));
            trv.borrowMax(dai, alice);

            vm.startPrank(executor);
            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 50e18);
            trv.addStrategy(address(strategy), -123, debtCeiling);
        }

        {
            vm.startPrank(address(strategy));

            vm.expectEmit(address(trv));
            emit Borrow(address(strategy), address(dai), alice, 50e18);

            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(strategy), address(dai), 0, 50e18);

            trv.borrowMax(dai, alice);
        }

        {
            assertEq(trv.strategyTokenCredits(address(strategy), dai), 0);
            assertEq(trv.availableForStrategyToBorrow(address(strategy), dai), 0);

            assertEq(dai.balanceOf(address(trv)), 70e18);

            assertEq(dai.balanceOf(address(strategy)), 0);
            assertEq(dai.balanceOf(alice), 50e18);

            assertEq(dUSD.balanceOf(address(strategy)), 50e18);
        }
    }

    function test_borrow_baseStrategyWithdraw_NoDebtTokens() public {
        MockBaseStrategy baseStrategy = new MockBaseStrategy(rescuer, executor, "MockBaseStrategy", address(trv), address(dai));
        uint256 debtCeiling = 100e18;

        // Setup the config
        {
            vm.startPrank(executor);
            trv.setBorrowToken(dai, address(baseStrategy), 0, 0, address(dUSD));

            ITempleStrategy.AssetBalance[] memory debtCeilingArr = new ITempleStrategy.AssetBalance[](1);
            debtCeilingArr[0] = ITempleStrategy.AssetBalance(address(dai), debtCeiling);
            trv.addStrategy(address(baseStrategy), 0, debtCeilingArr);
            trv.addStrategy(address(strategy), 0, debtCeilingArr);
        }

        // The base strategy and TRV has no DAI, so it reverts.
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InsufficientBalance.selector, address(dai), 50e18, 0));
        strategy.borrow(dai, 50e18);
    }

    function test_borrow_baseStrategyOverflow() public {
        MockBaseStrategy baseStrategy = new MockBaseStrategy(rescuer, executor, "MockBaseStrategy", address(trv), address(dai));
        uint256 debtCeiling = type(uint256).max - 10e18;

        // Setup the config
        {
            vm.startPrank(executor);
            trv.setBorrowToken(dai, address(baseStrategy), 0, 0, address(dUSD));

            deal(address(dai), address(baseStrategy), 100e18, true);

            ITempleStrategy.AssetBalance[] memory debtCeilingArr = new ITempleStrategy.AssetBalance[](1);
            debtCeilingArr[0] = ITempleStrategy.AssetBalance(address(dai), debtCeiling);
            trv.addStrategy(address(baseStrategy), 0, debtCeilingArr);
            trv.addStrategy(address(strategy), 0, debtCeilingArr);
        }

        // Base strategy repays 100 DAI such that it now has a credit.
        // The 10e18 is now in the TRV
        deal(address(dai), executor, 10e18, true);
        dai.approve(address(trv), 10e18);
        trv.repay(dai, 10e18, address(baseStrategy));

        uint256 available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, debtCeiling);

        uint256 availableBase = trv.availableForStrategyToBorrow(address(baseStrategy), dai);
        assertEq(availableBase, debtCeiling + 10e18);

        // The strategy can borrow up to 10 DAI
        strategy.borrow(dai, 10e18);

        available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, debtCeiling - 10e18);
        
        // The available amount for the base strategy is still the same
        // because no new DAI was borrowed/repaid - it was pulled straight from the TRV.
        availableBase = trv.availableForStrategyToBorrow(address(baseStrategy), dai);
        assertEq(availableBase, debtCeiling + 10e18);

        // Any more borrowed, and the base strategy total ceiling+credit overflows.
        // It can't have a total credit > uint256.max
        vm.expectRevert(stdError.arithmeticError);
        strategy.borrow(dai, 1);
    }

}
