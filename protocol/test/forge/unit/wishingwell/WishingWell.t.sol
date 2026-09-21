pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/wishingwell/WishingWell.t.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";

import { IWishingWell } from "contracts/interfaces/wishingwell/IWishingWell.sol";

import { TempleGoldCommon } from "test/forge/unit/templegold/TempleGoldCommon.t.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";

import { WishingWell } from "contracts/wishingwell/WishingWell.sol";


contract MockWallet is IERC1271 {
    bytes32 public digest;

    function approve(bytes32 digest_) external {
        digest = digest_;
    }

    function isValidSignature(bytes32 hash, bytes memory) external view returns (bytes4) {
        return hash == digest ? IERC1271.isValidSignature.selector : bytes4(0xffffffff);
    }
}

contract RevertingWallet is IERC1271 {
    function isValidSignature(bytes32, bytes memory) external pure returns (bytes4) {
        revert("Wallet validation failed");
    }
}

contract WishingWellTestBase is TempleGoldCommon {

    event WishSet(
        address indexed account,
        address indexed targetToken,
        address indexed amountAsset,
        IWishingWell.Direction direction,
        uint128 amount,
        uint64 expiresAt,
        uint256 nonce
    );
    event WishRevoked(address indexed account, address indexed targetToken, uint256 nonce);
    event ExclusionSet(address indexed targetToken, address indexed account, bool excluded);

    string internal constant WELL_NAME = "Wishing Well";
    string internal constant WELL_VERSION = "1.0";

    WishingWell well;
    // address internal operator = mkAddr("mike");

    FakeERC20 internal TEMPLE_TOKEN;
    FakeERC20 internal TGLD;
    FakeERC20 internal USDS;
    // address target = address(100);
    // address payment = address(200);
    uint256 key = 12345;

    function setUp() public {
        vm.warp(1000);
        well = new WishingWell(executor, rescuer, WELL_NAME, WELL_VERSION);
        TEMPLE_TOKEN = new FakeERC20("Temple Token", "TEMPLE", executor, 1000 ether);
        TGLD = new FakeERC20("Temple Gold", "TGLD", executor, 1000 ether);
        USDS = new FakeERC20("USDC", "USDC", executor, 1000 ether);
    }

    function sell(address user, uint128 amount, uint64 duration) internal {
        vm.prank(user);
        well.setWish(address(USDS), IWishingWell.Direction.Sell, address(USDS), amount, duration);
    }

    function active(address user) internal view returns (uint256) {
        return well.activeAmount(user, address(USDS), IWishingWell.Direction.Sell, address(USDS));
    }

    function signedWish() internal returns (IWishingWell.SignedWish memory) {
        emit log_string("Key's account");
        emit log_address(vm.addr(key));
        return IWishingWell.SignedWish(
            vm.addr(key),
            address(USDS),
            address(USDS),
            IWishingWell.Direction.Sell,
            100,
            uint64(block.timestamp + 30 days),
            0,
            uint64(block.timestamp + 1 days)
        );
    }

    function sign(IWishingWell.SignedWish memory wish) internal returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, well.wishDigest(wish));
        return abi.encodePacked(r, s, v);
    }

    function test_wishing_well_initialization() public {
        assertEq(well.executor(), executor);
        assertEq(well.rescuer(), rescuer);
        assertEq(well.name(), WELL_NAME);
        assertEq(well.version(), WELL_VERSION);
    }
}

contract WishingWellTestAccess is WishingWellTestBase {

    function test_access_setExcluded() public {
        vm.prank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        well.setExcluded(address(USDS), alice, true);
    }

}

contract WishingWellTest is WishingWellTestBase {

    function test_set_replace_and_expiry_boundary() public {
        sell(alice, 100, 10);
        assertEq(active(alice), 100);
        skip(5);
        sell(alice, 40, 20);
        assertEq(active(alice), 40);
        skip(5);
        assertEq(active(alice), 40);
        skip(15);
        assertEq(active(alice), 0);
        assertEq(well.getWish(alice, address(USDS)).amount, 40); // history retained; no expiry transaction
    }

    function test_replacement_across_directions_and_assets() public {
        sell(alice, 100, 100);
        vm.prank(alice);
        well.setWish(address(USDS), IWishingWell.Direction.Buy, address(TGLD), 400, 100);
        assertEq(active(alice), 0);
        assertEq(well.activeAmount(alice, address(USDS), IWishingWell.Direction.Buy, address(TGLD)), 400);
        assertEq(well.activeAmount(alice, address(USDS), IWishingWell.Direction.Buy, address(201)), 0);
    }

    function test_independent_tokens_and_accounts() public {
        sell(alice, 100, 100);
        sell(bob, 50, 100);
        vm.prank(alice);
        well.setWish(address(TGLD), IWishingWell.Direction.Sell, address(TGLD), 400, 100);
        assertEq(active(alice), 100);
        assertEq(active(bob), 50);
    }

    function test_revocation_only_affects_caller() public {
        sell(alice, 100, 100);
        sell(bob, 50, 100);
        vm.prank(bob);
        well.revokeWish(address(USDS));
        assertEq(active(alice), 100);
        assertEq(active(bob), 0);
    }

    function test_exclusion_and_restoration() public {
        sell(alice, 100, 100);
        vm.prank(executor);
        well.setExcluded(address(USDS), alice, true);
        assertEq(active(alice), 0);
        sell(alice, 200, 100);
        assertEq(active(alice), 0); // cannot evade by replacement
        vm.prank(executor);
        well.setExcluded(address(USDS), alice, false);
        assertEq(active(alice), 200);
        vm.prank(executor);
        well.setExcluded(address(TGLD), alice, true);
        assertEq(active(alice), 200);
    }

    function test_excluded_user_can_revoke() public {
        sell(alice, 100, 100);
        vm.prank(executor);
        well.setExcluded(address(USDS), alice, true);
        vm.prank(alice);
        well.revokeWish(address(USDS));
        assertEq(well.getWish(alice, address(USDS)).amount, 0);
    }

    function test_restoration_does_not_revive_expired_wish() public {
        sell(alice, 100, 10);
        vm.prank(executor);
        well.setExcluded(address(USDS), alice, true);
        vm.warp(1010);
        vm.prank(executor);
        well.setExcluded(address(USDS), alice, false);
        assertEq(active(alice), 0);
    }

    function test_total_filters_expiry__and_rejects_unsorted_accounts() public {
        sell(alice, 100, 10);
        sell(bob, 50, 20);
        // alice > bob
        address[] memory accounts = new address[](2);
        accounts[0] = alice;
        accounts[1] = bob;
        vm.expectRevert(IWishingWell.InvalidAccountList.selector);
        well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts);

        // correct order
        accounts[0] = accounts[1];
        accounts[1] = alice;
        well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts);
    }

    function test_total_filters_expiry_and_rejects_duplicate_accounts() public {
        sell(alice, 100, 10);
        sell(bob, 50, 20);
        address[] memory accounts = new address[](2);
        accounts[0] = bob;
        accounts[1] = alice;
        assertEq(well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts), 150);
        vm.warp(1010);
        assertEq(well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts), 50);
        accounts[1] = bob;
        vm.expectRevert(IWishingWell.InvalidAccountList.selector);
        well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts);
    }

    function test_reject_empty_list() public {
        address[] memory accounts = new address[](0);
        // empty list, returns 0
        uint256 total = well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts);
        assertEq(total, 0);
    }

    function test_reject_list_with_zero_address() public {
        address[] memory accounts = new address[](2);
        accounts[0] = address(0);
        accounts[1] = bob;
        vm.expectRevert(IWishingWell.InvalidAccountList.selector);
        well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts);
    }

    function test_reject_oversize_lists() public {
        address[] memory accounts = new address[](101);
        vm.expectRevert(IWishingWell.InvalidAccountList.selector);
        well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts);
    }

    function test_invalid_wish_fields_non_zeros() public {
        vm.expectRevert(CommonEventsAndErrors.ExpectedNonZero.selector);
        well.setWish(address(USDS), IWishingWell.Direction.Sell, address(USDS), 0, 10);
        vm.expectRevert(CommonEventsAndErrors.ExpectedNonZero.selector);
        well.setWish(address(USDS), IWishingWell.Direction.Sell, address(USDS), 1, 0);
    }

    function test_invalid_wish_fields() public {
        vm.expectRevert(IWishingWell.InvalidWish.selector);
        well.setWish(address(USDS), IWishingWell.Direction.Sell, address(TGLD), 1, 10);
        vm.expectRevert(IWishingWell.InvalidWish.selector);
        well.setWish(address(USDS), IWishingWell.Direction.Buy, address(USDS), 1, 10);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        well.setWish(address(0), IWishingWell.Direction.Sell, address(USDS), 1, 10);
    }

    function test_signed_wish_and_replay() public {
        IWishingWell.SignedWish memory wish = signedWish();
        bytes memory sig = sign(wish);
        vm.prank(bob);
        well.setWishBySignature(wish, sig);
        assertEq(active(vm.addr(key)), 100);
        vm.expectRevert(IWishingWell.InvalidNonce.selector);
        well.setWishBySignature(wish, sig);
    }

    function test_revoke_invalidates_unsubmitted_signature() public {
        IWishingWell.SignedWish memory wish = signedWish();
        bytes memory sig = sign(wish);
        vm.prank(wish.account);
        well.revokeWish(address(USDS));
        vm.expectRevert(IWishingWell.InvalidNonce.selector);
        well.setWishBySignature(wish, sig);
    }

    function test_direct_replacement_invalidates_signature() public {
        IWishingWell.SignedWish memory wish = signedWish();
        bytes memory sig = sign(wish);
        sell(wish.account, 5, 100);
        vm.expectRevert(IWishingWell.InvalidNonce.selector);
        well.setWishBySignature(wish, sig);
    }

    function test_tampering_and_wrong_signer() public {
        IWishingWell.SignedWish memory wish = signedWish();
        bytes memory sig = sign(wish);
        wish.amount = 101;
        vm.expectRevert(IWishingWell.InvalidSignature.selector);
        well.setWishBySignature(wish, sig);
        wish.amount = 100;
        wish.account = bob;
        vm.expectRevert(IWishingWell.InvalidSignature.selector);
        well.setWishBySignature(wish, sig);
        emit log_address(address(this));
    }

    function test_signature_deadline_boundary() public {
        IWishingWell.SignedWish memory wish = signedWish();
        bytes memory sig = sign(wish);
        vm.warp(wish.submissionDeadline);
        vm.expectRevert(IWishingWell.SignatureExpired.selector);
        well.setWishBySignature(wish, sig);
    }

    function test_relay_does_not_extend_expiry() public {
        IWishingWell.SignedWish memory wish = signedWish();
        bytes memory sig = sign(wish);
        vm.warp(block.timestamp + 1 hours);
        well.setWishBySignature(wish, sig);
        assertEq(well.getWish(wish.account, address(USDS)).expiresAt, wish.expiresAt);
    }

    function test_cross_contract_and_chain_replay_rejected() public {
        IWishingWell.SignedWish memory wish = signedWish();
        bytes memory sig = sign(wish);
        WishingWell other = new WishingWell(executor, operator, WELL_NAME, WELL_VERSION);
        vm.expectRevert(IWishingWell.InvalidSignature.selector);
        other.setWishBySignature(wish, sig);
        vm.chainId(block.chainid + 1);
        vm.expectRevert(IWishingWell.InvalidSignature.selector);
        well.setWishBySignature(wish, sig);
    }

    function test_contract_wallet_signature() public {
        MockWallet wallet = new MockWallet();
        IWishingWell.SignedWish memory wish = signedWish();
        wish.account = address(wallet);
        wallet.approve(well.wishDigest(wish));
        well.setWishBySignature(wish, hex"1234");
        assertEq(active(address(wallet)), 100);
    }

    function test_reject_invalid_contract_wallet_signature() public {
        IWishingWell.SignedWish memory wish = signedWish();
        wish.account = address(new MockWallet());
        vm.expectRevert(IWishingWell.InvalidSignature.selector);
        well.setWishBySignature(wish, hex"1234");
    }

    function test_reject_ether() public {
        vm.deal(address(this), 1 ether);
        (bool success,) = address(well).call{value: 1}("");
        assertFalse(success);
    }

    function test_one_second_wish_and_renewal_after_expiry() public {
        sell(alice, 100, 1);
        assertEq(active(alice), 100);
        skip(1);
        assertEq(active(alice), 0);
        sell(alice, 25, 1);
        assertEq(active(alice), 25);
        assertEq(well.nonces(alice, address(USDS)), 2);
        skip(1);
        assertEq(active(alice), 0);
    }

    function test_unexclude_does_not_restore_revoked_wish() public {
        sell(alice, 100, 100);
        vm.prank(executor);
        well.setExcluded(address(USDS), alice, true);
        vm.prank(alice);
        well.revokeWish(address(USDS));
        vm.prank(executor);
        well.setExcluded(address(USDS), alice, false);
        assertEq(active(alice), 0);
        assertEq(well.getWish(alice, address(USDS)).amount, 0);
    }

    function test_signed_wish_cannot_bypass_exclusion() public {
        IWishingWell.SignedWish memory wish = signedWish();
        vm.prank(executor);
        well.setExcluded(address(USDS), wish.account, true);
        well.setWishBySignature(wish, sign(wish));
        assertEq(active(wish.account), 0);
        assertEq(well.getWish(wish.account, address(USDS)).amount, 100);
        vm.prank(executor);
        well.setExcluded(address(USDS), wish.account, false);
        assertEq(active(wish.account), 100);
    }

    function test_competing_signatures_at_same_nonce_first_wins() public {
        IWishingWell.SignedWish memory first = signedWish();
        IWishingWell.SignedWish memory second = signedWish();
        second.amount = 200;
        bytes memory secondSig = sign(second);
        well.setWishBySignature(first, sign(first));
        vm.expectRevert(IWishingWell.InvalidNonce.selector);
        well.setWishBySignature(second, secondSig);
        assertEq(active(first.account), 100);
        assertEq(well.nonces(first.account, address(USDS)), 1);
    }

    function test_failed_signature_preserves_existing_wish() public {
        IWishingWell.SignedWish memory wish = signedWish();
        sell(wish.account, 75, 100);
        wish.nonce = 1;
        bytes memory sig = sign(wish);
        wish.amount = 200;
        vm.expectRevert(IWishingWell.InvalidSignature.selector);
        well.setWishBySignature(wish, sig);
        assertEq(active(wish.account), 75);
        assertEq(well.nonces(wish.account, address(USDS)), 1);
        assertEq(well.getWish(wish.account, address(USDS)).expiresAt, 1100);
    }

    function test_submission_immediately_before_deadline_and_expiry() public {
        IWishingWell.SignedWish memory wish = signedWish();
        wish.submissionDeadline = wish.expiresAt;
        bytes memory sig = sign(wish);
        vm.warp(uint256(wish.expiresAt) - 1);
        well.setWishBySignature(wish, sig);
        assertEq(active(wish.account), 100);
        vm.warp(wish.expiresAt);
        assertEq(active(wish.account), 0);
    }

    function test_expired_signed_wish() public {
        IWishingWell.SignedWish memory wish = signedWish();
        wish.submissionDeadline = wish.expiresAt;
        bytes memory sig = sign(wish);
        vm.warp(wish.expiresAt);
        vm.expectRevert(IWishingWell.SignatureExpired.selector);
        well.setWishBySignature(wish, sig);
        assertEq(well.nonces(wish.account, address(USDS)), 0);
    }

    function test_reverting_contract_wallets_rejected() public {
        IWishingWell.SignedWish memory wish = signedWish();
        wish.account = address(new RevertingWallet());
        vm.expectRevert(IWishingWell.InvalidSignature.selector);
        well.setWishBySignature(wish, hex"1234");
        assertEq(well.nonces(wish.account, address(USDS)), 0);
    }

    function test_signed_zero_token_addresses_rejected() public {
        IWishingWell.SignedWish memory wish = signedWish();
        wish.targetToken = address(0);
        bytes memory sig = sign(wish);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        well.setWishBySignature(wish, sig);
        wish = signedWish();
        wish.amountAsset = address(0);
        sig = sign(wish);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        well.setWishBySignature(wish, sig);
    }

    function test_buy_amounts_never_mixed_across_payment_assets() public {
        address otherPayment = address(201);
        vm.prank(alice);
        well.setWish(address(USDS), IWishingWell.Direction.Buy, address(TGLD), 100, 100);
        vm.prank(bob);
        well.setWish(address(USDS), IWishingWell.Direction.Buy, otherPayment, 200, 100);
        address[] memory accounts = new address[](2);
        // bob < alice
        accounts[0] = bob;
        accounts[1] = alice;
        assertEq(well.totalForAccounts(address(USDS), IWishingWell.Direction.Buy, address(TGLD), accounts), 100);
        assertEq(well.totalForAccounts(address(USDS), IWishingWell.Direction.Buy, otherPayment, accounts), 200);
        assertEq(well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts), 0);
    }

    function test_repeated_revoke_invalidates_pending_signatures() public {
        IWishingWell.SignedWish memory wish = signedWish();
        vm.prank(wish.account);
        well.revokeWish(address(USDS));
        wish.nonce = 1;
        bytes memory sig = sign(wish);
        vm.prank(wish.account);
        well.revokeWish(address(USDS));
        vm.expectRevert(IWishingWell.InvalidNonce.selector);
        well.setWishBySignature(wish, sig);
        assertEq(well.nonces(wish.account, address(USDS)), 2);
    }

    function test_pm_timeline() public {
        uint256 start = block.timestamp;
        address[] memory accounts = new address[](3);
        accounts[0] = bob;
        accounts[1] = alice;
        accounts[2] = operator;
        sell(alice, 100, 30 days);
        assertEq(well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts), 100);
        vm.warp(start + 15 days);
        sell(bob, 500, 60 days);
        assertEq(well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts), 600);
        vm.warp(start + 30 days);
        assertEq(well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts), 500);
        vm.warp(start + 50 days);
        sell(operator, 200, 30 days);
        assertEq(well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts), 700);
        vm.warp(start + 60 days);
        sell(bob, 400, 30 days);
        assertEq(well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts), 600);
        vm.warp(start + 80 days);
        assertEq(well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts), 400);
        vm.warp(start + 90 days);
        assertEq(well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts), 0);
    }

    function test_events_identify_replacements_and_consumed_nonce() public {
        vm.expectEmit(true, true, true, true, address(well));
        emit WishSet(alice, address(USDS), address(USDS), IWishingWell.Direction.Sell, 100, 1100, 0);
        sell(alice, 100, 100);
        vm.expectEmit(true, true, true, true, address(well));
        emit WishSet(alice, address(USDS), address(USDS), IWishingWell.Direction.Sell, 50, 1200, 1);
        sell(alice, 50, 200);
        vm.expectEmit(true, true, false, true, address(well));
        emit WishRevoked(alice, address(USDS), 2);
        vm.prank(alice);
        well.revokeWish(address(USDS));
        assertEq(well.nonces(alice, address(USDS)), 3);
    }

    function test_exclusion_event_and_no_nonce_change() public {
        sell(alice, 100, 100);
        vm.expectEmit(true, true, false, true, address(well));
        emit ExclusionSet(address(USDS), alice, true);
        vm.prank(executor);
        well.setExcluded(address(USDS), alice, true);
        assertEq(well.nonces(alice, address(USDS)), 1);
        assertEq(well.getWish(alice, address(USDS)).amount, 100);
    }

    function test_empty_and_unknown_accounts_contribute_zero() public {
        address[] memory accounts = new address[](0);
        assertEq(well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts), 0);
        assertEq(active(alice), 0);
        assertEq(well.getWish(alice, address(USDS)).expiresAt, 0);
    }

    // /// @dev Tests the current implementation cap; 100 is not a PM requirement.
    function test_maximum_batch_and_amounts_do_not_overflow() public {
        address[] memory accounts = new address[](well.MAX_ACCOUNTS());
        for (uint256 i; i < accounts.length; ++i) {
            accounts[i] = address(uint160(1000 + i));
            sell(accounts[i], type(uint128).max, 100);
        }
        assertEq(
            well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts),
            uint256(type(uint128).max) * accounts.length
        );
    }

    function test_expiry_overflow_rejected_without_replacing_wish() public {
        sell(alice, 100, 100);
        vm.prank(alice);
        vm.expectRevert(IWishingWell.InvalidWish.selector);
        well.setWish(address(USDS), IWishingWell.Direction.Sell, address(USDS), 200, type(uint64).max);
        assertEq(active(alice), 100);
        assertEq(well.nonces(alice, address(USDS)), 1);
    }

    function test_revoke_wish_invalid_address() public {
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        well.revokeWish(address(0));
    }

    function test_set_wish_zero_amount() public {
        vm.expectRevert(CommonEventsAndErrors.ExpectedNonZero.selector);
        well.setWish(address(USDS), IWishingWell.Direction.Buy, address(USDS), 0, 10);
    }

    function test_set_wish_zero_duration() public {
        vm.expectRevert(CommonEventsAndErrors.ExpectedNonZero.selector);
        well.setWish(address(USDS), IWishingWell.Direction.Buy, address(USDS), 100, 0);
    }

    function test_set_wish_invalid_address() public {
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        well.setWish(address(USDS), IWishingWell.Direction.Buy, address(0), 100, 10);
    }

    function test_setExcluded_invalid_address() public {
        vm.startPrank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        well.setExcluded(address(0), alice, true);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        well.setExcluded(address(USDS), address(0), true);
    }

    function test_typed_digest_matches_independent_encoding() public {
        IWishingWell.SignedWish memory wish = signedWish();
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("Wishing Well"),
                keccak256("1.0"),
                block.chainid,
                address(well)
            )
        );
        bytes32 content = keccak256(
            abi.encode(
                keccak256(
                    "Wish(address account,address targetToken,address amountAsset,uint8 direction,uint128 amount,uint64 expiresAt,uint256 nonce,uint64 submissionDeadline)"
                ),
                wish.account,
                wish.targetToken,
                wish.amountAsset,
                uint8(wish.direction),
                wish.amount,
                wish.expiresAt,
                wish.nonce,
                wish.submissionDeadline
            )
        );
        assertEq(well.wishDigest(wish), keccak256(abi.encodePacked(hex"1901", domain, content)));
    }

    function test_signed_buy_and_sequential_nonce() public {
        IWishingWell.SignedWish memory wish = signedWish();
        wish.direction = IWishingWell.Direction.Buy;
        wish.amountAsset = address(TGLD);
        well.setWishBySignature(wish, sign(wish));
        wish.nonce = 1;
        wish.amount = 400;
        well.setWishBySignature(wish, sign(wish));
        assertEq(well.activeAmount(wish.account, address(USDS), IWishingWell.Direction.Buy, address(TGLD)), 400);
        assertEq(well.nonces(wish.account, address(USDS)), 2);
    }

    function test_revoking_one_token_does_not_invalidate_another_signature() public {
        IWishingWell.SignedWish memory wish = signedWish();
        bytes memory sig = sign(wish);
        vm.prank(wish.account);
        well.revokeWish(address(TGLD));
        well.setWishBySignature(wish, sig);
        assertEq(active(wish.account), 100);
    }

    function test_invalid_signed_wish_does_not_consume_nonce() public {
        IWishingWell.SignedWish memory wish = signedWish();
        wish.amount = 0;
        bytes memory sig = sign(wish);
        vm.expectRevert(CommonEventsAndErrors.ExpectedNonZero.selector);
        well.setWishBySignature(wish, sig);
        assertEq(well.nonces(wish.account, address(USDS)), 0);
        wish.amount = 100;
        well.setWishBySignature(wish, sign(wish));
        assertEq(active(wish.account), 100);
    }

    function test_signed_deadline_beyond_wish_expiry_rejected() public {
        IWishingWell.SignedWish memory wish = signedWish();
        wish.submissionDeadline = wish.expiresAt + 1;
        bytes memory sig = sign(wish);
        vm.expectRevert(IWishingWell.InvalidWish.selector);
        well.setWishBySignature(wish, sig);
    }

    function test_zero_signer_and_malformed_signature() public {
        IWishingWell.SignedWish memory wish = signedWish();
        wish.account = address(0);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        well.setWishBySignature(wish, hex"");
        wish.account = vm.addr(key);
        vm.expectRevert(IWishingWell.InvalidSignature.selector);
        well.setWishBySignature(wish, hex"1234");
        assertEq(well.nonces(wish.account, address(USDS)), 0);
    }

    function test_revoked_contract_wallet_approval_rejected() public {
        MockWallet wallet = new MockWallet();
        IWishingWell.SignedWish memory wish = signedWish();
        wish.account = address(wallet);
        wallet.approve(well.wishDigest(wish));
        wallet.approve(bytes32(0));
        vm.expectRevert(IWishingWell.InvalidSignature.selector);
        well.setWishBySignature(wish, hex"1234");
    }
}