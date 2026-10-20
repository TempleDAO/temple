pragma solidity ^0.8.20;
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

    address[3] internal accounts;
    address[3] internal tokens;
    /// @dev The values of the last `WishSet` seen for each (account, from, to).
    mapping(address account => mapping(address from => mapping(address to => IWishingWell.Wish))) internal lastWishSet;

    /// @dev Over random wishes from several accounts, every stored wish equals the last `WishSet` for its key, and
    /// that event names the caller as the account: nobody changes another account's wish.
    function test_fuzz_wishMatchesLastWishSet(uint256 seed) public {
        accounts = [alice, bob, makeAddr("carol")];
        tokens = [tgld, usds, usdc];
        for (uint256 step; step < 20; ++step) {
            _wishAndCheck(uint256(keccak256(abi.encode(seed, step))));
            _assertEveryWishIsLastWishSet();
        }
    }

    function _wishAndCheck(uint256 r) internal {
        address caller = accounts[r % 3];
        // A quarter of wishes revoke (amount 0).
        uint192 amount = (r >> 8) % 4 == 0 ? 0 : uint192(r >> 16);
        vm.recordLogs();
        vm.prank(caller);
        well.wish(tokens[(r >> 2) % 3], tokens[(r >> 4) % 3], amount, uint64(r >> 208));

        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1, "not one WishSet per wish");
        assertEq(logs[0].topics[0], IWishingWell.WishSet.selector);
        address account = address(uint160(uint256(logs[0].topics[1])));
        assertEq(account, caller, "WishSet for an account other than the caller");
        (uint256 eventAmount, uint64 eventExpiresAt) = abi.decode(logs[0].data, (uint256, uint64));
        lastWishSet[account][address(uint160(uint256(logs[0].topics[2])))][address(uint160(uint256(logs[0].topics[3])))]
        = IWishingWell.Wish(uint192(eventAmount), eventExpiresAt);
    }

    function _assertEveryWishIsLastWishSet() internal view {
        for (uint256 i; i < 27; ++i) {
            (address account, address from, address to) = (accounts[i / 9], tokens[(i / 3) % 3], tokens[i % 3]);
            IWishingWell.Wish memory w = lastWishSet[account][from][to];
            _assertWish(account, from, to, w.amount, w.expiresAt);
        }
    }
}
