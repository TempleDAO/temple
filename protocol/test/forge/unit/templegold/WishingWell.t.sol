pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "test/forge/unit/TempleTest.sol";
import { IWishingWell } from "contracts/interfaces/templegold/IWishingWell.sol";
import { WishingWell } from "contracts/templegold/WishingWell.sol";

contract WishingWellTest is TempleTest {
    WishingWell internal well;
    address internal tgld = makeAddr("tgld");
    address internal usds = makeAddr("usds");
    address internal usdc = makeAddr("usdc");

    function setUp() public {
        well = new WishingWell();
    }

    function _assertWish(address account, address from, address to, uint192 amount, uint64 expiresAt) internal view {
        (uint192 actualAmount, uint64 actualExpiresAt) = well.wishOf(account, from, to);
        assertEq(actualAmount, amount, "amount");
        assertEq(actualExpiresAt, expiresAt, "expiresAt");
    }

    function test_wish_setReplaceRevoke() public {
        vm.expectEmit(address(well));
        emit IWishingWell.WishSet(alice, usds, tgld, 100e18, 2_000);
        vm.prank(alice);
        well.wish(usds, tgld, 100e18, 2_000);
        _assertWish(alice, usds, tgld, 100e18, 2_000);

        vm.prank(alice);
        well.wish(usds, tgld, 40e18, 3_000);
        _assertWish(alice, usds, tgld, 40e18, 3_000);

        vm.expectEmit(address(well));
        emit IWishingWell.WishSet(alice, usds, tgld, 0, 0);
        vm.prank(alice);
        well.wish(usds, tgld, 0, 0);
        _assertWish(alice, usds, tgld, 0, 0);
    }

    function test_wish_pairsAndAccountsAreIndependent() public {
        vm.startPrank(alice);
        well.wish(usds, tgld, 1e18, 10);
        well.wish(usdc, tgld, 2e6, 20);
        well.wish(tgld, usds, 3e18, 30);
        vm.stopPrank();
        vm.prank(bob);
        well.wish(usds, tgld, 4e18, 40);

        _assertWish(alice, usds, tgld, 1e18, 10);
        _assertWish(alice, usdc, tgld, 2e6, 20);
        _assertWish(alice, tgld, usds, 3e18, 30);
        _assertWish(bob, usds, tgld, 4e18, 40);
        _assertWish(bob, usdc, tgld, 0, 0);
    }
}
