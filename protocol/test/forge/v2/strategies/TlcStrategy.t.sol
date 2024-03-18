pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TlcBaseTest } from "../templeLineOfCredit/TlcBaseTest.t.sol";
import { TlcStrategy } from "contracts/v2/strategies/TlcStrategy.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

/* solhint-disable func-name-mixedcase, not-rely-on-time */
contract TlcStrategyTest is TlcBaseTest {
    TlcStrategy public strategy;
    event Borrow(uint256 amount, address recipient);

    function extraSetup() internal {
        strategy = new TlcStrategy(rescuer, executor, "TlcStrategy", address(trv), address(tlc), address(daiToken));

        vm.startPrank(executor);
        trv.setBorrowToken(daiToken, address(0), 0, 0, address(dUSD));
        ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
        debtCeiling[0] = ITempleStrategy.AssetBalance(address(daiToken), 100e18);
        trv.addStrategy(address(strategy), -123, debtCeiling);
        vm.stopPrank();
    }

    function test_initalization() public {
        extraSetup();
        assertEq(strategy.executor(), executor);
        assertEq(strategy.rescuer(), rescuer);
        assertEq(strategy.apiVersion(), "1.0.0");
        assertEq(strategy.strategyName(), "TlcStrategy");
        assertEq(strategy.strategyVersion(), "1.0.0");
        assertEq(address(strategy.treasuryReservesVault()), address(trv));
        assertEq(address(strategy.tlc()), address(tlc));
        assertEq(address(strategy.daiToken()), address(daiToken));
        ITempleStrategy.AssetBalanceDelta[] memory adjs = strategy.manualAdjustments();
        assertEq(adjs.length, 0);
    }

    function test_automatedShutdown() public {
        extraSetup();
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.Unimplemented.selector));
        strategy.automatedShutdown("");
    }

    function test_access_fundFromTrv() public {
        extraSetup();
        expectElevatedAccess();
        strategy.fundFromTrv(100, alice);
    }

    function test_fundFromTrv() public {
        extraSetup();
        vm.startPrank(address(tlc));
        vm.expectEmit(address(strategy));
        emit Borrow(1e18, alice);
        strategy.fundFromTrv(1e18, alice);

        assertEq(daiToken.balanceOf(alice), 1e18);
    }

    function test_latestAssetBalances() public {
        extraSetup();

        borrow(alice, 10_000e18, 1_000e18, BORROW_REQUEST_MIN_SECS);
        vm.warp(block.timestamp + 365 days);

        ITempleStrategy.AssetBalance[] memory assetBalances = strategy.latestAssetBalances();
        assertEq(assetBalances.length, 1);
        assertEq(assetBalances[0].asset, address(daiToken));
        assertApproxEqAbs(assetBalances[0].balance, 1_051.85e18, 0.01e18);
    }
}
