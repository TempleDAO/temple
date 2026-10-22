pragma solidity ^0.8.21;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Vm } from "forge-std/Vm.sol";
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

    address[3] internal accounts;
    address[3] internal tokens;
    /// @dev The last wish each (account, from, to) set, tracked from the inputs.
    mapping(address account => mapping(address from => mapping(address to => IWishingWell.Wish))) internal expected;

    /// @dev Over random wishes from several accounts, every stored wish and every `WishSet` equals the inputs of the
    /// caller's last wish for that key: nobody changes another account's wish or another pair's.
    function test_fuzz_wishMatchesInputs(uint256 seed) public {
        accounts = [alice, bob, makeAddr("carol")];
        tokens = [tgld, usds, usdc];
        for (uint256 step; step < 20; ++step) {
            _wishAndCheck(uint256(keccak256(abi.encode(seed, step))));
            _assertEveryWishIsExpected();
        }
    }

    function _wishAndCheck(uint256 r) internal {
        address caller = accounts[r % 3];
        (address from, address to) = (tokens[(r >> 2) % 3], tokens[(r >> 4) % 3]);
        // A quarter of wishes revoke (amount 0).
        uint192 amount = (r >> 8) % 4 == 0 ? 0 : uint192(r >> 16);
        uint64 expiresAt = uint64(r >> 208);
        vm.recordLogs();
        vm.prank(caller);
        well.wish(from, to, amount, expiresAt);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1, "not one WishSet per wish");
        assertEq(logs[0].topics[0], IWishingWell.WishSet.selector);
        assertEq(logs[0].topics[1], bytes32(uint256(uint160(caller))), "WishSet account");
        assertEq(logs[0].topics[2], bytes32(uint256(uint160(from))), "WishSet from");
        assertEq(logs[0].topics[3], bytes32(uint256(uint160(to))), "WishSet to");
        assertEq(logs[0].data, abi.encode(amount, expiresAt), "WishSet amount or expiresAt");
        expected[caller][from][to] = IWishingWell.Wish(amount, expiresAt);
    }

    function _assertEveryWishIsExpected() internal view {
        for (uint256 i; i < 27; ++i) {
            (address account, address from, address to) = (accounts[i / 9], tokens[(i / 3) % 3], tokens[i % 3]);
            IWishingWell.Wish memory w = expected[account][from][to];
            _assertWish(account, from, to, w.amount, w.expiresAt);
        }
    }
}
