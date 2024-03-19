pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TreasuryReservesVault, ITreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { MockBaseStrategy } from "../strategies/MockBaseStrategy.t.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";
import { TreasuryReservesVaultTestBase } from "./TrvBase.t.sol";

/* solhint-disable func-name-mixedcase, contract-name-camelcase, not-rely-on-time */
contract TreasuryReservesVaultTestViews is TreasuryReservesVaultTestBase {
    function setUp() public {
        _setUp();
    }

    function test_balanceSheet() public {
        (
            ITempleStrategy.AssetBalance[] memory assetBalances, 
            ITempleStrategy.AssetBalanceDelta[] memory manAdjustments, 
            ITempleStrategy.AssetBalance[] memory dTokenBalances,
            ITempleStrategy.AssetBalance[] memory dTokenCreditBalances
        ) = trv.strategyBalanceSheet(address(strategy));
        
        assertEq(assetBalances.length, reportedAssets.length);
        assertEq(assetBalances.length, 2);
        assertEq(assetBalances[0].asset, reportedAssets[0]);
        assertEq(assetBalances[0].balance, 0);
        assertEq(assetBalances[1].asset, reportedAssets[1]);
        assertEq(assetBalances[1].balance, 0);
        assertEq(manAdjustments.length, 0);
        assertEq(dTokenBalances.length, 0);
        assertEq(dTokenCreditBalances.length, 0);

        // Setup dai to be borrowed
        {
            vm.startPrank(executor);
            trv.setBorrowToken(dai, address(0), 100, 101, address(dUSD));
            deal(address(dai), address(trv), 100e18, true);
        }

        // Deal some assets
        {
            deal(address(weth), address(strategy), 100, true);
            deal(address(temple), address(strategy), 200, true);

            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 100e18);
            trv.addStrategy(address(strategy), -123, debtCeiling);
            strategy.borrow(dai, 100e18);
        }

        // Set manual adjustments
        ITempleStrategy.AssetBalanceDelta[] memory deltas = new ITempleStrategy.AssetBalanceDelta[](3);
        deltas[0] = ITempleStrategy.AssetBalanceDelta(address(weth), 50);
        deltas[1] = ITempleStrategy.AssetBalanceDelta(address(dai), -50);
        deltas[2] = ITempleStrategy.AssetBalanceDelta(address(temple), 1000);
        strategy.setManualAdjustments(deltas);

        (
            assetBalances, 
            manAdjustments, 
            dTokenBalances,
            dTokenCreditBalances
        ) = trv.strategyBalanceSheet(address(strategy));
        assertEq(assetBalances.length, 2);
        assertEq(assetBalances[0].asset, reportedAssets[0]);
        assertEq(assetBalances[0].balance, 100e18);
        assertEq(assetBalances[1].asset, reportedAssets[1]);
        assertEq(assetBalances[1].balance, 100);
        assertEq(manAdjustments.length, 3);
        assertEq(manAdjustments[0].asset, address(weth));
        assertEq(manAdjustments[0].delta, 50);
        assertEq(manAdjustments[1].asset, address(dai));
        assertEq(manAdjustments[1].delta, -50);
        assertEq(manAdjustments[2].asset, address(temple));
        assertEq(manAdjustments[2].delta, 1000);
        assertEq(dTokenBalances.length, 1);
        assertEq(dTokenBalances[0].asset, reportedAssets[0]);
        assertEq(dTokenBalances[0].balance, 100e18);
        assertEq(dTokenCreditBalances.length, 1);
        assertEq(dTokenCreditBalances[0].asset, reportedAssets[0]);
        assertEq(dTokenCreditBalances[0].balance, 0);

        deal(address(dai), address(strategy), 175e18, true);
        strategy.repay(dai, 150e18);
        (
            assetBalances, 
            manAdjustments, 
            dTokenBalances,
            dTokenCreditBalances
        ) = trv.strategyBalanceSheet(address(strategy));
        assertEq(assetBalances.length, 2);
        assertEq(assetBalances[0].asset, reportedAssets[0]);
        assertEq(assetBalances[0].balance, 25e18);
        assertEq(assetBalances[1].asset, reportedAssets[1]);
        assertEq(assetBalances[1].balance, 100);
        assertEq(manAdjustments.length, 3);
        assertEq(manAdjustments[0].asset, address(weth));
        assertEq(manAdjustments[0].delta, 50);
        assertEq(manAdjustments[1].asset, address(dai));
        assertEq(manAdjustments[1].delta, -50);
        assertEq(manAdjustments[2].asset, address(temple));
        assertEq(manAdjustments[2].delta, 1000);
        assertEq(dTokenBalances.length, 1);
        assertEq(dTokenBalances[0].asset, reportedAssets[0]);
        assertEq(dTokenBalances[0].balance, 0);
        assertEq(dTokenCreditBalances.length, 1);
        assertEq(dTokenCreditBalances[0].asset, reportedAssets[0]);
        assertEq(dTokenCreditBalances[0].balance, 50e18);
    }

    function test_totalAvailable() public {
        MockBaseStrategy baseStrategy = new MockBaseStrategy(rescuer, executor, "MockBaseStrategy", address(trv), address(dai));

        // Borrow token needs to exist
        {
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.BorrowTokenNotEnabled.selector));
            trv.totalAvailable(dai);

            vm.startPrank(executor);
            trv.setBorrowToken(dai, address(0), 100, 101, address(dUSD));
        }

        assertEq(trv.totalAvailable(dai), 0);

        // Setup the config
        {
            vm.startPrank(executor);
            trv.setBorrowToken(dai, address(baseStrategy), 0, 0, address(dUSD));

            deal(address(dai), address(trv), 757e18, true);

            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 1_000e18);
            trv.addStrategy(address(baseStrategy), -123, debtCeiling);
            trv.addStrategy(address(strategy), -123, debtCeiling);

            // The base strategy now has a dUSD debt of 200e18
            baseStrategy.borrowAndDeposit(150e18);
        }

        assertEq(trv.totalAvailable(dai), 757e18);
    }
}
