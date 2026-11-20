pragma solidity ^0.8.21;
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

    function _assertWish(
        address account,
        address fromToken,
        address toToken,
        uint192 fromAmount,
        uint64 expiresAt
    ) internal view {
        (uint192 actualFromAmount, uint64 actualExpiresAt) = well.wishOf(account, fromToken, toToken);
        assertEq(actualFromAmount, fromAmount, "fromAmount");
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


    address[3] internal accounts;
    address[3] internal tokens;
    /// @dev The last wish each account made for each (fromToken, toToken), from the call's own inputs.
    mapping(address account => mapping(address fromToken => mapping(address toToken => IWishingWell.Wish))) internal
        lastWishSet;

    /// @dev Over random wishes from several accounts, every stored wish equals the last wish its account made for
    /// that pair, and each emits one `WishSet` with the call's inputs: nobody changes another account's wish.
    function test_fuzz_wishMatchesInputs(uint256 seed) public {
        accounts = [alice, bob, makeAddr("carol")];
        tokens = [tgld, usds, usdc];
        for (uint256 step; step < 20; ++step) {
            _wishAndCheck(uint256(keccak256(abi.encode(seed, step))));
            _assertEveryWishIsLastWishSet();
        }
    }

    function _wishAndCheck(uint256 r) internal {
        address caller = accounts[r % 3];
        (address fromToken, address toToken) = (tokens[(r >> 2) % 3], tokens[(r >> 4) % 3]);
        // A quarter of wishes revoke (fromAmount 0).
        uint192 fromAmount = (r >> 8) % 4 == 0 ? 0 : uint192(r >> 16);
        uint64 expiresAt = uint64(r >> 208);
        vm.expectEmit(address(well));
        emit IWishingWell.WishSet(caller, fromToken, toToken, fromAmount, expiresAt);
        vm.recordLogs();
        vm.prank(caller);
        well.wish(fromToken, toToken, fromAmount, expiresAt);
        assertEq(vm.getRecordedLogs().length, 1, "not one WishSet per wish");
        lastWishSet[caller][fromToken][toToken] = IWishingWell.Wish(fromAmount, expiresAt);
    }

    function _assertEveryWishIsLastWishSet() internal view {
        for (uint256 i; i < 27; ++i) {
            (address account, address fromToken, address toToken) =
                (accounts[i / 9], tokens[(i / 3) % 3], tokens[i % 3]);
            IWishingWell.Wish memory w = lastWishSet[account][fromToken][toToken];
            _assertWish(account, fromToken, toToken, w.fromAmount, w.expiresAt);
        }
    }
}
