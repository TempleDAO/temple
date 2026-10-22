pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { FakeERC20CustomDecimals } from "contracts/fakes/FakeERC20CustomDecimals.sol";
import { IFixedPriceAuction } from "contracts/interfaces/templegold/IFixedPriceAuction.sol";
import { ITempleElevatedAccess } from "contracts/interfaces/v2/access/ITempleElevatedAccess.sol";
import { ComplianceCheck } from "contracts/templegold/ComplianceCheck.sol";
import { PRBMath_MulDiv_Overflow } from "@prb/math/src/Common.sol";
import { FixedPriceAuctionTestBase } from "test/forge/unit/templegold/FixedPriceAuction.t.sol";

/// @dev Excluding flagged bidders. 4 USDS per TEMPLE; Alice and Bob each bid 100 TEMPLE; full funding is 800 USDS.
contract FixedPriceAuctionExclusionTest is FixedPriceAuctionTestBase {
    FakeERC20CustomDecimals internal temple;
    address internal overlord = makeAddr("overlord");
    address internal carol = makeAddr("carol");

    function setUp() public override {
        super.setUp();
        temple = new FakeERC20CustomDecimals("Temple", "TEMPLE", address(0), 0, 18);
        auction = _create(_config(address(temple), address(usds), 4e18, 0));
        ITempleElevatedAccess.ExplicitAccess[] memory access = new ITempleElevatedAccess.ExplicitAccess[](1);
        access[0] = ITempleElevatedAccess.ExplicitAccess(ComplianceCheck.setBlocked.selector, true);
        vm.prank(executor);
        compliance.setExplicitAccess(overlord, access);
    }

    function _bothDeposit() internal {
        _toDeposit(auction);
        _deposit(auction, alice, 100e18);
        _deposit(auction, bob, 100e18);
    }

    function _exclude(address by, address account) internal {
        vm.expectEmit(address(auction));
        uint256 amount = auction.deposits(account);
        emit IFixedPriceAuction.BidderExcluded(account, amount);
        uint256 totalExcluded = auction.totalExcluded();
        vm.prank(by);
        auction.exclude(account);
        assertEq(auction.totalExcluded(), totalExcluded + amount, "totalExcluded");
    }

    function _reinstate(address by, address account) internal {
        vm.expectEmit(address(auction));
        uint256 amount = auction.excluded(account);
        emit IFixedPriceAuction.BidderReinstated(account, amount);
        uint256 totalExcluded = auction.totalExcluded();
        vm.prank(by);
        auction.reinstate(account);
        assertEq(auction.totalExcluded(), totalExcluded - amount, "totalExcluded");
    }

    function _withdrawExcluded(address account) internal {
        vm.expectEmit(address(auction));
        uint256 amount = auction.excluded(account);
        emit IFixedPriceAuction.ExcludedWithdrawn(account, amount);
        uint256 totalExcluded = auction.totalExcluded();
        vm.prank(account);
        auction.withdrawExcluded();
        assertEq(auction.excluded(account), 0);
        assertEq(auction.totalExcluded(), totalExcluded - amount, "totalExcluded");
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

    /// @dev An excluded balance stays owed, so recovery can take only a donation, even once everyone else is paid;
    /// after the blocked bidder is cleared and withdraws, nothing of theirs is left counted.
    function test_excludedBalance_notRecoverable() public {
        _bothDeposit();
        _setBlocked(alice, true);
        _exclude(executor, alice);
        _toFulfillment(auction);
        _fund(auction, 400e18);
        _toEnd(auction);
        vm.prank(bob);
        auction.claim();
        auction.claimTreasury();
        temple.mint(address(auction), 1e18);
        (uint256 bidOwed,) = auction.liabilities();
        assertEq(bidOwed, 100e18);

        vm.startPrank(executor);
        vm.expectRevert(
            abi.encodeWithSelector(CommonEventsAndErrors.InsufficientBalance.selector, temple, 1e18 + 1, 1e18)
        );
        auction.recoverToken(address(temple), executor, 1e18 + 1);
        auction.recoverToken(address(temple), executor, 1e18);
        vm.stopPrank();

        _setBlocked(alice, false);
        _withdrawExcluded(alice);
        _assertPaid(alice, 100e18, 0);
        (bidOwed,) = auction.liabilities();
        assertEq(bidOwed, 0);
        _assertPaid(address(auction), 0, 0);
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

        assertEq(auction.funding(), 400e18);
        _toEnd(auction);
        vm.prank(bob);
        auction.claim();
        auction.claimTreasury();

        _assertPaid(bob, 0, 400e18);
        _assertPaid(funder, 0, 200e18);
        _assertPaid(proceedsRecipient, 100e18, 0);
        _assertPaid(address(auction), 100e18, 0);
        assertEq(auction.excluded(alice), 100e18);
    }

    /// @dev Exclusion leaves 200 USDS above the reduced requirement. If the funder leaves it in the auction,
    /// claimTreasury refunds it at settlement while Alice's excluded TEMPLE stays held.
    function test_excludeInFulfillment_excessLeftUntilSettlement() public {
        _bothDeposit();
        _toFulfillment(auction);
        _fund(auction, 600e18);
        _setBlocked(alice, true);
        _exclude(overlord, alice);

        // Leave the excess in the auction instead of withdrawing it during Fulfillment.
        _toEnd(auction);
        IFixedPriceAuction.TreasuryClaim memory expected = auction.treasuryClaimable();
        assertEq(expected.proceeds, 100e18);
        assertEq(expected.funderRefund, 200e18);
        auction.claimTreasury();
        vm.prank(bob);
        auction.claim();

        _assertPaid(funder, 0, 200e18);
        _assertPaid(bob, 0, 400e18);
        _assertPaid(proceedsRecipient, 100e18, 0);
        _assertPaid(address(auction), 100e18, 0);
        assertEq(auction.excluded(alice), 100e18);
    }

    /// @dev Excluded in Fulfillment and still flagged at settlement: the excluded balance waits, frozen.
    function test_excludeInFulfillment_frozenUntilCleared() public {
        _bothDeposit();
        _toFulfillment(auction);
        _fund(auction, 400e18);
        _setBlocked(alice, true);
        _exclude(executor, alice);
        vm.prank(executor);
        auction.settleEarly();

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
        auction.settleEarly();
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
        assertEq(auction.claimable(alice).fill, 400e18);

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

        vm.prank(rescuer);
        auction.disableComplianceCheck();
        vm.prank(executor);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.AccountNotBlocked.selector, bob));
        auction.exclude(bob);
        vm.prank(overlord);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.exclude(bob);

        _withdrawExcluded(alice);
        _assertPaid(alice, 100e18, 0);
    }

    /// @dev Once compliance is disabled a list grant no longer authorizes reinstate; the msig still can.
    function test_complianceDisabled_grantCannotReinstate() public {
        _bothDeposit();
        _setBlocked(alice, true);
        _exclude(overlord, alice);

        vm.prank(rescuer);
        auction.disableComplianceCheck();
        vm.prank(overlord);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.reinstate(alice);
        _reinstate(executor, alice);
        assertEq(auction.deposits(alice), 100e18);
    }

    /// @dev Rescue mode doesn't bring the grant back: once compliance is disabled it can't reinstate there either.
    function test_complianceDisabled_grantCannotReinstate_rescueMode() public {
        _bothDeposit();
        _setBlocked(alice, true);
        _exclude(overlord, alice);

        vm.startPrank(rescuer);
        auction.disableComplianceCheck();
        auction.setRescueMode(true);
        vm.stopPrank();
        vm.prank(overlord);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.reinstate(alice);
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

    /// @dev Revoking the setBlocked grant takes exclude and reinstate away from the grantee, in rescue mode too.
    function test_revokedGrant_losesExcludeAndReinstate() public {
        _bothDeposit();
        _setBlocked(alice, true);
        _setBlocked(bob, true);
        _exclude(overlord, alice);
        _setBlocked(alice, false);

        ITempleElevatedAccess.ExplicitAccess[] memory access = new ITempleElevatedAccess.ExplicitAccess[](1);
        access[0] = ITempleElevatedAccess.ExplicitAccess(ComplianceCheck.setBlocked.selector, false);
        vm.prank(executor);
        compliance.setExplicitAccess(overlord, access);

        for (uint256 i; i < 2; ++i) {
            if (i == 1) {
                vm.prank(rescuer);
                auction.setRescueMode(true);
            }
            vm.prank(overlord);
            vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
            auction.exclude(bob);
            vm.prank(overlord);
            vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
            auction.reinstate(alice);
        }
    }

    /// @dev Rescue mode locks the executor out, but a compliance-list grant still works.
    function test_exclude_access_rescueMode() public {
        _bothDeposit();
        _setBlocked(alice, true);
        vm.prank(rescuer);
        auction.setRescueMode(true);

        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.exclude(alice);
        vm.prank(rescuer);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.exclude(alice);
        _exclude(overlord, alice);

        _setBlocked(alice, false);
        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.reinstate(alice);
        vm.prank(rescuer);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.reinstate(alice);
        _reinstate(overlord, alice);
    }

    /// @dev A grant on a list the auction no longer points at counts for nothing.
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

}
