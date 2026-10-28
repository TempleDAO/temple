pragma solidity ^0.8.21;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { FakeERC20CustomDecimals } from "contracts/fakes/FakeERC20CustomDecimals.sol";
import { IFixedPriceAuction } from "contracts/interfaces/templegold/IFixedPriceAuction.sol";
import { ComplianceCheck } from "contracts/templegold/ComplianceCheck.sol";
import { PRBMath_MulDiv_Overflow } from "@prb/math/src/Common.sol";
import { FixedPriceAuctionTestBase } from "test/forge/unit/templegold/FixedPriceAuction.t.sol";

/// @dev Excluding flagged bidders across the phases. 4 USDS per TEMPLE; Alice and Bob each bid 100 TEMPLE, so full
/// funding is 800 USDS.
contract FixedPriceAuctionExclusionTest is FixedPriceAuctionTestBase {
    FakeERC20CustomDecimals internal temple;
    address internal overlord = makeAddr("overlord");
    address internal carol = makeAddr("carol");

    function setUp() public override {
        super.setUp();
        temple = new FakeERC20CustomDecimals("Temple", "TEMPLE", address(0), 0, 18);
        auction = _create(_config(address(temple), address(usds), 4e18, 0));
        vm.prank(executor);
        compliance.setBlocker(overlord, true);
    }

    function _bothDeposit() internal {
        _toDeposit(auction);
        _deposit(auction, alice, 100e18);
        _deposit(auction, bob, 100e18);
    }

    function _exclude(address by, address account) internal {
        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.BidderExcluded(account, auction.deposits(account));
        vm.prank(by);
        auction.exclude(account);
    }

    function _reinstate(address by, address account) internal {
        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.BidderReinstated(account, auction.excluded(account));
        vm.prank(by);
        auction.reinstate(account);
    }

    function _withdrawExcluded(address account) internal {
        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.ExcludedWithdrawn(account, auction.excluded(account));
        vm.prank(account);
        auction.withdrawExcluded();
        assertEq(auction.excluded(account), 0);
    }

    function _expectNothingToClaim(address account) internal {
        vm.prank(account);
        vm.expectRevert(IFixedPriceAuction.NothingToClaim.selector);
        auction.claim();
    }

    function _assertPaid(address account, uint256 expectedTemple, uint256 expectedUsds) internal view {
        assertEq(temple.balanceOf(account), expectedTemple, "TEMPLE balance");
        assertEq(usds.balanceOf(account), expectedUsds, "USDS balance");
    }

    /// @dev Flagged while Scheduled: there's nothing to exclude, and the account can't deposit until cleared.
    function test_flaggedScheduled_nothingToExclude_depositsOnceCleared() public {
        _setBlocked(alice, true);
        vm.prank(executor);
        vm.expectRevert(
            abi.encodeWithSelector(
                IFixedPriceAuction.InvalidPhase.selector,
                IFixedPriceAuction.Phase.Fulfillment,
                IFixedPriceAuction.Phase.Scheduled
            )
        );
        auction.exclude(alice);

        _toDeposit(auction);
        temple.mint(alice, 100e18);
        vm.startPrank(alice);
        temple.approve(address(auction), 100e18);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.BlockedAccount.selector, alice));
        auction.deposit(100e18);
        vm.stopPrank();

        _setBlocked(alice, false);
        vm.prank(alice);
        auction.deposit(100e18);
        assertEq(auction.deposits(alice), 100e18);
    }

    /// @dev Excluded in Deposit and cleared in Deposit: reinstated, and both fill in full.
    function test_excludeInDeposit_reinstate_bothFillInFull() public {
        _bothDeposit();
        _setBlocked(alice, true);
        _exclude(overlord, alice);
        assertEq(auction.deposits(alice), 0);
        assertEq(auction.excluded(alice), 100e18);
        assertEq(auction.totalDeposits(), 100e18);

        _setBlocked(alice, false);
        _reinstate(executor, alice);
        assertEq(auction.deposits(alice), 100e18);
        assertEq(auction.excluded(alice), 0);
        assertEq(auction.totalDeposits(), 200e18);

        _toFulfillment(auction);
        _fund(auction, 800e18);
        _toEnd(auction);
        _claimAll(auction);
        _assertPaid(alice, 0, 400e18);
        _assertPaid(bob, 0, 400e18);
        _assertPaid(proceedsRecipient, 200e18, 0);
        _assertPaid(address(auction), 0, 0);
    }

    /// @dev Excluded in Deposit, cleared in Fulfillment: refund only. The funder funds just Bob's 400.
    function test_excludeInDeposit_clearedInFulfillment_refundOnly() public {
        _bothDeposit();
        _setBlocked(alice, true);
        _exclude(executor, alice);

        _toFulfillment(auction);
        _setBlocked(alice, false);
        vm.prank(executor);
        vm.expectRevert(
            abi.encodeWithSelector(
                IFixedPriceAuction.InvalidPhase.selector,
                IFixedPriceAuction.Phase.Deposit,
                IFixedPriceAuction.Phase.Fulfillment
            )
        );
        auction.reinstate(alice);

        _fund(auction, 400e18);
        assertEq(auction.withdrawableExcess(), 0);
        _withdrawExcluded(alice);
        _assertPaid(alice, 100e18, 0);

        _toEnd(auction);
        _expectNothingToClaim(alice);
        vm.prank(bob);
        auction.claim();
        auction.claimTreasury();
        _assertPaid(bob, 0, 400e18);
        _assertPaid(proceedsRecipient, 100e18, 0);
        _assertPaid(funder, 0, 0);
        _assertPaid(address(auction), 0, 0);
    }

    /// @dev Excluded in Deposit, cleared and re-deposited: only the new deposit fills, the excluded bid is refund only.
    function test_excludeInDeposit_redeposit_onlyNewDepositFills() public {
        _bothDeposit();
        _setBlocked(alice, true);
        _exclude(executor, alice);
        _setBlocked(alice, false);
        _deposit(auction, alice, 50e18);
        assertEq(auction.totalDeposits(), 150e18);

        _toFulfillment(auction);
        _fund(auction, 600e18);
        _toEnd(auction);
        _claimAll(auction);
        _assertPaid(alice, 0, 200e18);
        _assertPaid(bob, 0, 400e18);
        _assertPaid(proceedsRecipient, 150e18, 0);
        _assertPaid(address(auction), 100e18, 0);

        _withdrawExcluded(alice);
        _assertPaid(alice, 100e18, 200e18);
        _assertPaid(address(auction), 0, 0);
    }

    /// @dev Excluded in Fulfillment after full funding: Alice's 400 becomes withdrawable excess, Bob fills, and
    /// Alice gets her bid back once cleared, even after settlement.
    function test_excludeInFulfillment_afterFullFunding() public {
        _bothDeposit();
        _toFulfillment(auction);
        _fund(auction, 800e18);
        assertEq(auction.withdrawableExcess(), 0);

        _setBlocked(alice, true);
        _exclude(overlord, alice);
        assertEq(auction.withdrawableExcess(), 400e18);
        vm.prank(funder);
        auction.withdrawExcess(400e18);
        _assertPaid(funder, 0, 400e18);

        // Cleared in the same phase: still refund only.
        _setBlocked(alice, false);
        vm.prank(overlord);
        vm.expectRevert(
            abi.encodeWithSelector(
                IFixedPriceAuction.InvalidPhase.selector,
                IFixedPriceAuction.Phase.Deposit,
                IFixedPriceAuction.Phase.Fulfillment
            )
        );
        auction.reinstate(alice);

        _toEnd(auction);
        vm.prank(bob);
        auction.claim();
        auction.claimTreasury();
        _expectNothingToClaim(alice);
        _withdrawExcluded(alice);
        _assertPaid(alice, 100e18, 0);
        _assertPaid(bob, 0, 400e18);
        _assertPaid(proceedsRecipient, 100e18, 0);
        _assertPaid(funder, 0, 400e18);
        _assertPaid(address(auction), 0, 0);
    }

    /// @dev Exclusion lowers full funding from 800 to 400 USDS. With 600 held, Bob fills in full and the funder
    /// can withdraw 200 excess, even though the auction was underfunded before exclusion.
    function test_excludeInFulfillment_fundingAboveReducedRequirement() public {
        _bothDeposit();
        _toFulfillment(auction);
        _fund(auction, 600e18);
        assertEq(auction.withdrawableExcess(), 0);

        _setBlocked(alice, true);
        _exclude(overlord, alice);
        assertEq(auction.totalDeposits(), 100e18);
        assertEq(auction.withdrawableExcess(), 200e18);

        vm.prank(funder);
        auction.withdrawExcess(200e18);

        assertEq(auction.fillOwed(), 400e18);
        _toEnd(auction);
        vm.prank(bob);
        auction.claim();
        auction.claimTreasury();

        _assertPaid(bob, 0, 400e18);
        _assertPaid(funder, 0, 200e18);
        _assertPaid(proceedsRecipient, 100e18, 0);
        _assertPaid(address(auction), 100e18, 0);
        assertEq(auction.excluded(alice), 100e18);
        assertEq(auction.bidOwed(), 100e18);
        assertEq(auction.fillOwed(), 0);
    }

    /// @dev Exclusion leaves 200 USDS above the reduced requirement. If the funder leaves it in the auction,
    /// claimTreasury refunds it at settlement while Alice's excluded TEMPLE stays reserved.
    function test_excludeInFulfillment_excessLeftUntilSettlement() public {
        _bothDeposit();
        _toFulfillment(auction);
        _fund(auction, 600e18);
        _setBlocked(alice, true);
        _exclude(overlord, alice);

        // Leave the excess in the auction instead of withdrawing it during Fulfillment.
        _toEnd(auction);
        IFixedPriceAuction.TreasuryClaim memory expected = auction.treasuryClaimable();
        assertEq(expected.bidTokenAmount, 100e18);
        assertEq(expected.fillTokenRefund, 200e18);
        auction.claimTreasury();
        vm.prank(bob);
        auction.claim();

        _assertPaid(funder, 0, 200e18);
        _assertPaid(bob, 0, 400e18);
        _assertPaid(proceedsRecipient, 100e18, 0);
        _assertPaid(address(auction), 100e18, 0);
        assertEq(auction.bidOwed(), 100e18);
        assertEq(auction.fillOwed(), 0);
    }

    /// @dev Excluded in Fulfillment and still flagged at settlement: the excluded balance waits, frozen.
    function test_excludeInFulfillment_frozenUntilCleared() public {
        _bothDeposit();
        _toFulfillment(auction);
        _fund(auction, 400e18);
        _setBlocked(alice, true);
        _exclude(executor, alice);
        vm.prank(executor);
        auction.endFulfillment();

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.BlockedAccount.selector, alice));
        auction.withdrawExcluded();
        vm.prank(bob);
        auction.claim();
        auction.claimTreasury();
        _assertPaid(bob, 0, 400e18);
        _assertPaid(proceedsRecipient, 100e18, 0);
        _assertPaid(address(auction), 100e18, 0);

        _setBlocked(alice, false);
        _withdrawExcluded(alice);
        _assertPaid(alice, 100e18, 0);
    }

    /// @dev Flagged once settled, by the clock or early: no exclusion. The fill stands, the treasury gets both bids,
    /// and Alice's payout waits until she's cleared.
    function test_flaggedAfterSettlement_notExcluded() public {
        _bothDeposit();
        _toFulfillment(auction);
        _fund(auction, 800e18);
        vm.prank(executor);
        auction.endFulfillment();
        _setBlocked(alice, true);

        vm.prank(executor);
        vm.expectRevert(
            abi.encodeWithSelector(
                IFixedPriceAuction.InvalidPhase.selector,
                IFixedPriceAuction.Phase.Fulfillment,
                IFixedPriceAuction.Phase.Settled
            )
        );
        auction.exclude(alice);
        _toEnd(auction);
        vm.prank(overlord);
        vm.expectRevert(
            abi.encodeWithSelector(
                IFixedPriceAuction.InvalidPhase.selector,
                IFixedPriceAuction.Phase.Fulfillment,
                IFixedPriceAuction.Phase.Settled
            )
        );
        auction.exclude(alice);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.BlockedAccount.selector, alice));
        auction.claim();
        auction.claimTreasury();
        vm.prank(bob);
        auction.claim();
        _assertPaid(proceedsRecipient, 200e18, 0);
        _assertPaid(bob, 0, 400e18);

        _setBlocked(alice, false);
        vm.prank(alice);
        auction.claim();
        _assertPaid(alice, 0, 400e18);
        _assertPaid(address(auction), 0, 0);
    }

    /// @dev Flagged during Deposit but never excluded: still in the fill, filled at settlement, payout frozen.
    function test_flaggedNotExcluded_filledAndFrozen() public {
        _bothDeposit();
        _setBlocked(alice, true);
        _toFulfillment(auction);
        _fund(auction, 800e18);
        _toEnd(auction);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.BlockedAccount.selector, alice));
        auction.claim();
        auction.claimTreasury();
        _assertPaid(proceedsRecipient, 200e18, 0);
        assertEq(auction.claimable(alice).fillTokenAmount, 400e18);

        _setBlocked(alice, false);
        vm.prank(alice);
        auction.claim();
        _assertPaid(alice, 0, 400e18);
    }

    /// @dev Cancelled with an excluded balance: it stays frozen while flagged, then comes back whole. Bob and the
    /// funder are refunded as usual.
    function test_cancel_withExcludedBalance() public {
        _bothDeposit();
        _toFulfillment(auction);
        _fund(auction, 800e18);
        _setBlocked(alice, true);
        _exclude(executor, alice);
        vm.prank(executor);
        auction.cancel();

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.BlockedAccount.selector, alice));
        auction.withdrawExcluded();
        vm.prank(executor);
        vm.expectRevert(
            abi.encodeWithSelector(
                IFixedPriceAuction.InvalidPhase.selector,
                IFixedPriceAuction.Phase.Fulfillment,
                IFixedPriceAuction.Phase.Cancelled
            )
        );
        auction.exclude(bob);

        vm.prank(bob);
        auction.claim();
        auction.claimTreasury();
        _assertPaid(bob, 100e18, 0);
        _assertPaid(funder, 0, 800e18);

        _setBlocked(alice, false);
        _expectNothingToClaim(alice);
        _withdrawExcluded(alice);
        _assertPaid(alice, 100e18, 0);
        _assertPaid(address(auction), 0, 0);
    }

    /// @dev With compliance disabled nobody is flagged: nothing can be excluded, and every excluded balance can be
    /// withdrawn, even by an account still on the list.
    function test_complianceDisabled_excludeReverts_withdrawExcludedWorks() public {
        _bothDeposit();
        _setBlocked(alice, true);
        _exclude(executor, alice);
        _setBlocked(bob, true);

        vm.startPrank(rescuer);
        auction.setRescueMode(true);
        auction.disableComplianceCheck();
        auction.setRescueMode(false);
        vm.stopPrank();
        vm.prank(executor);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.AccountNotBlocked.selector, bob));
        auction.exclude(bob);
        vm.prank(overlord);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.exclude(bob);

        _withdrawExcluded(alice);
        _assertPaid(alice, 100e18, 0);
    }

    /// @dev Once compliance is disabled a blocker can no longer reinstate; the msig still can.
    function test_complianceDisabled_blockerCannotReinstate() public {
        _bothDeposit();
        _setBlocked(alice, true);
        _exclude(overlord, alice);

        vm.startPrank(rescuer);
        auction.setRescueMode(true);
        auction.disableComplianceCheck();
        auction.setRescueMode(false);
        vm.stopPrank();
        vm.prank(overlord);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.reinstate(alice);
        _reinstate(executor, alice);
        assertEq(auction.deposits(alice), 100e18);
    }

    function test_exclude_access() public {
        _bothDeposit();
        _setBlocked(alice, true);
        _setBlocked(bob, true);

        vm.prank(unauthorizedUser);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.exclude(alice);
        vm.prank(rescuer);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.exclude(alice);
        _exclude(executor, alice);
        _exclude(overlord, bob);

        _setBlocked(alice, false);
        _setBlocked(bob, false);
        vm.prank(unauthorizedUser);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.reinstate(alice);
        vm.prank(rescuer);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.reinstate(alice);
        _reinstate(executor, alice);
        _reinstate(overlord, bob);
    }

    /// @dev Removing a blocker takes exclude and reinstate away from it.
    function test_removedBlocker_losesExcludeAndReinstate() public {
        _bothDeposit();
        _setBlocked(alice, true);
        _setBlocked(bob, true);
        _exclude(overlord, alice);
        _setBlocked(alice, false);

        vm.prank(executor);
        compliance.setBlocker(overlord, false);

        vm.prank(overlord);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.exclude(bob);
        vm.prank(overlord);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.reinstate(alice);
    }

    /// @dev Rescue mode locks out the executor and every blocker, so a hijacked msig that makes itself a blocker on
    /// the list, which has no rescue mode, still can't exclude or reinstate.
    function test_exclude_access_rescueMode() public {
        _bothDeposit();
        _setBlocked(alice, true);
        _exclude(overlord, alice);
        _setBlocked(alice, false);
        _setBlocked(bob, true);
        vm.prank(rescuer);
        auction.setRescueMode(true);

        vm.prank(executor);
        compliance.setBlocker(executor, true);

        address[3] memory callers = [executor, rescuer, overlord];
        for (uint256 i; i < callers.length; ++i) {
            vm.prank(callers[i]);
            vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
            auction.exclude(bob);
            vm.prank(callers[i]);
            vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
            auction.reinstate(alice);
        }

        vm.prank(rescuer);
        auction.setRescueMode(false);
        _exclude(overlord, bob);
        _reinstate(overlord, alice);
    }

    /// @dev A blocker on a list the msig pointed at before rescue mode can't exclude once rescue mode is on, and the
    /// rescuer can't point the auction back.
    function test_exclude_access_rescueMode_repointedList() public {
        _bothDeposit();
        ComplianceCheck rogue = new ComplianceCheck(unauthorizedUser);
        address[] memory accounts = new address[](1);
        accounts[0] = alice;
        vm.startPrank(unauthorizedUser);
        rogue.setBlocker(unauthorizedUser, true);
        rogue.setBlocked(accounts, true);
        vm.stopPrank();
        vm.prank(executor);
        auction.setComplianceCheck(address(rogue));

        vm.startPrank(rescuer);
        auction.setRescueMode(true);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.setComplianceCheck(address(compliance));
        vm.stopPrank();

        vm.prank(unauthorizedUser);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.exclude(alice);
    }

    /// @dev A blocker on a list the auction no longer points at can't exclude.
    function test_exclude_access_followsCurrentList() public {
        _bothDeposit();
        ComplianceCheck other = new ComplianceCheck(executor);
        address[] memory accounts = new address[](1);
        accounts[0] = alice;
        vm.startPrank(executor);
        other.setBlocked(accounts, true);
        auction.setComplianceCheck(address(other));
        vm.stopPrank();

        vm.prank(overlord);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.exclude(alice);
        _exclude(executor, alice);
    }

    /// @dev Exclude and reinstate move no tokens, so they work while paused; withdrawExcluded doesn't.
    function test_paused() public {
        _bothDeposit();
        vm.prank(executor);
        auction.setPaused(true);
        _setBlocked(alice, true);
        _exclude(overlord, alice);
        _setBlocked(alice, false);
        _reinstate(overlord, alice);
        _setBlocked(alice, true);
        _exclude(overlord, alice);
        _setBlocked(alice, false);

        vm.prank(alice);
        vm.expectRevert(IFixedPriceAuction.IsPaused.selector);
        auction.withdrawExcluded();
        vm.prank(executor);
        auction.setPaused(false);
        _withdrawExcluded(alice);
    }

    function test_exclude_fail() public {
        _bothDeposit();
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.AccountNotBlocked.selector, alice));
        auction.exclude(alice);
        vm.stopPrank();

        _setBlocked(carol, true);
        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.ExpectedNonZero.selector);
        auction.exclude(carol);

        // A second exclude finds nothing left in the fill.
        _setBlocked(alice, true);
        _exclude(executor, alice);
        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.ExpectedNonZero.selector);
        auction.exclude(alice);
    }

    function test_reinstate_fail() public {
        _bothDeposit();
        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.ExpectedNonZero.selector);
        auction.reinstate(alice);

        _setBlocked(alice, true);
        _exclude(executor, alice);
        vm.prank(executor);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.BlockedAccount.selector, alice));
        auction.reinstate(alice);

        _setBlocked(alice, false);
        vm.prank(executor);
        auction.cancel();
        vm.prank(executor);
        vm.expectRevert(
            abi.encodeWithSelector(
                IFixedPriceAuction.InvalidPhase.selector,
                IFixedPriceAuction.Phase.Deposit,
                IFixedPriceAuction.Phase.Cancelled
            )
        );
        auction.reinstate(alice);
    }

    function test_withdrawExcluded_fail_nothingExcluded() public {
        _bothDeposit();
        vm.prank(alice);
        vm.expectRevert(IFixedPriceAuction.NothingToClaim.selector);
        auction.withdrawExcluded();
    }

    /// @dev Cleared during Deposit, the account can deposit afresh and still reinstate: the balances add up.
    function test_reinstate_addsToNewDeposit() public {
        _bothDeposit();
        _setBlocked(alice, true);
        _exclude(executor, alice);
        _setBlocked(alice, false);
        _deposit(auction, alice, 50e18);
        _reinstate(executor, alice);
        assertEq(auction.deposits(alice), 150e18);
        assertEq(auction.totalDeposits(), 250e18);
    }

    /// @dev A second exclusion adds to the excluded balance rather than overwriting it.
    function test_exclude_twice_accumulates() public {
        _bothDeposit();
        _setBlocked(alice, true);
        _exclude(executor, alice);
        _setBlocked(alice, false);
        _deposit(auction, alice, 50e18);
        _setBlocked(alice, true);
        _exclude(executor, alice);
        assertEq(auction.excluded(alice), 150e18);
        _setBlocked(alice, false);
        _withdrawExcluded(alice);
        assertEq(temple.balanceOf(address(auction)), 100e18);
    }

    /// @dev Others can deposit while a balance is excluded, so putting it back re-runs the deposit overflow guard.
    function test_reinstate_fail_fundingOverflow() public {
        uint256 hugePrice = uint256(type(uint128).max);
        auction = _create(_config(address(temple), address(usds), hugePrice, 0));
        _toDeposit(auction);
        _deposit(auction, alice, 3e56);
        _setBlocked(alice, true);
        _exclude(executor, alice);
        _deposit(auction, bob, 3e56);

        _setBlocked(alice, false);
        vm.prank(executor);
        vm.expectRevert(abi.encodeWithSelector(PRBMath_MulDiv_Overflow.selector, 6e56, hugePrice, 1e18));
        auction.reinstate(alice);
        assertEq(auction.excluded(alice), 3e56);
    }

    /// @dev Excluded tokens stay owed until withdrawn, so they can never be recovered.
    function test_bidOwed_coversExcluded() public {
        _bothDeposit();
        _setBlocked(alice, true);
        _exclude(executor, alice);
        assertEq(auction.bidOwed(), 200e18);
        _toFulfillment(auction);
        _fund(auction, 400e18);
        _toEnd(auction);
        vm.prank(bob);
        auction.claim();
        auction.claimTreasury();
        assertEq(auction.bidOwed(), 100e18);

        vm.prank(executor);
        vm.expectRevert(
            abi.encodeWithSelector(CommonEventsAndErrors.InsufficientBalance.selector, address(temple), 1, 0)
        );
        auction.recoverToken(address(temple), executor, 1);

        _setBlocked(alice, false);
        _withdrawExcluded(alice);
        assertEq(auction.bidOwed(), 0);
    }
}
