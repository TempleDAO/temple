pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FakeERC20CustomDecimals } from "contracts/fakes/FakeERC20CustomDecimals.sol";
import { TempleMath } from "contracts/common/TempleMath.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import { IFixedPriceAuction } from "contracts/interfaces/templegold/IFixedPriceAuction.sol";
import { ComplianceCheck } from "contracts/templegold/ComplianceCheck.sol";
import { FixedPriceAuctionTestBase } from "test/forge/unit/templegold/FixedPriceAuction.t.sol";
import { FixedPriceAuctionHandler } from "./handlers/FixedPriceAuctionHandler.sol";
import { FakeBlocklistERC20 } from "./handlers/FakeBlocklistERC20.sol";

/// @dev The suite, for one auction configuration. Each concrete contract below picks the decimals and price.
abstract contract FixedPriceAuctionInvariantBase is FixedPriceAuctionTestBase {
    using TempleMath for uint256;

    FixedPriceAuctionHandler internal handler;
    FakeERC20CustomDecimals internal bid;
    FakeERC20CustomDecimals internal fill;
    uint256 internal price;

    /// @dev The configuration under test: token decimals and the fixed price.
    function _auctionConfig() internal pure virtual returns (uint8 bidDecimals, uint8 fillDecimals, uint256 price_);

    /// @dev Whether the fill token has a USDC-style blocklist the handler can block bidders on.
    function _blocklistFill() internal pure virtual returns (bool) {
        return false;
    }

    function setUp() public override {
        super.setUp();
        (uint8 bidDecimals, uint8 fillDecimals, uint256 price_) = _auctionConfig();
        price = price_;
        bid = new FakeERC20CustomDecimals("Bid", "BID", address(0), 0, bidDecimals);
        fill = _blocklistFill()
            ? new FakeBlocklistERC20("Fill", "FILL", fillDecimals, flagger)
            : new FakeERC20CustomDecimals("Fill", "FILL", address(0), 0, fillDecimals);
        auction = _create(_config(address(bid), address(fill), price, 100));
        ComplianceCheck compliance2 = new ComplianceCheck(executor);
        vm.startPrank(executor);
        compliance.setFlagger(flagger, true);
        compliance2.setFlagger(flagger, true);
        vm.stopPrank();
        FakeERC20CustomDecimals stray = new FakeERC20CustomDecimals("Stray", "STRAY", address(0), 0, 18);

        handler = new FixedPriceAuctionHandler(auction, compliance, compliance2, stray, executor, rescuer, flagger);
        targetContract(address(handler));
        targetSelector(FuzzSelector({ addr: address(handler), selectors: _weightedSelectors() }));
    }

    // A repeated selector is picked more often. Time, deposits, funding and claims are weighted up.
    function _weightedSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](64);
        uint256 i;
        i = _add(s, i, FixedPriceAuctionHandler.warp.selector, 5);
        i = _add(s, i, FixedPriceAuctionHandler.deposit.selector, 6);
        i = _add(s, i, FixedPriceAuctionHandler.claim.selector, 6);
        i = _add(s, i, FixedPriceAuctionHandler.claimTreasury.selector, 2);
        i = _add(s, i, FixedPriceAuctionHandler.fund.selector, 6);
        i = _add(s, i, FixedPriceAuctionHandler.withdrawDeposit.selector, 1);
        i = _add(s, i, FixedPriceAuctionHandler.withdrawExcess.selector, 1);
        i = _add(s, i, FixedPriceAuctionHandler.settleEarly.selector, 1);
        i = _add(s, i, FixedPriceAuctionHandler.emitSettlement.selector, 1);
        i = _add(s, i, FixedPriceAuctionHandler.cancel.selector, 1);
        i = _add(s, i, FixedPriceAuctionHandler.recoverToken.selector, 1);
        i = _add(s, i, FixedPriceAuctionHandler.setPausedByMsig.selector, 1);
        i = _add(s, i, FixedPriceAuctionHandler.setComplianceCheck.selector, 1);
        i = _add(s, i, FixedPriceAuctionHandler.setPausedByRescuer.selector, 1);
        i = _add(s, i, FixedPriceAuctionHandler.setPausedByFlagger.selector, 1);
        i = _add(s, i, FixedPriceAuctionHandler.setRescueMode.selector, 1);
        i = _add(s, i, FixedPriceAuctionHandler.cancelByRescuer.selector, 1);
        i = _add(s, i, FixedPriceAuctionHandler.disableComplianceCheck.selector, 1);
        i = _add(s, i, FixedPriceAuctionHandler.rescuerOverreach.selector, 1);
        i = _add(s, i, FixedPriceAuctionHandler.setFlagged.selector, 1);
        i = _add(s, i, FixedPriceAuctionHandler.exclude.selector, 6);
        i = _add(s, i, FixedPriceAuctionHandler.reinstate.selector, 6);
        i = _add(s, i, FixedPriceAuctionHandler.withdrawExcluded.selector, 2);
        i = _add(s, i, FixedPriceAuctionHandler.strayTransfer.selector, 1);
        i = _add(s, i, FixedPriceAuctionHandler.proposeExecutor.selector, 1);
        i = _add(s, i, FixedPriceAuctionHandler.acceptExecutor.selector, 1);
        i = _add(s, i, FixedPriceAuctionHandler.proposeRescuer.selector, 1);
        i = _add(s, i, FixedPriceAuctionHandler.acceptRescuer.selector, 1);
        if (_blocklistFill()) i = _add(s, i, FixedPriceAuctionHandler.setFillTokenBlocked.selector, 1);
        // Trim the array to the selectors added.
        assembly {
            mstore(s, i)
        }
    }

    function _add(bytes4[] memory s, uint256 i, bytes4 selector, uint256 weight) private pure returns (uint256) {
        for (uint256 n; n < weight; ++n) {
            s[i++] = selector;
        }
        return i;
    }

    function _settled() internal view returns (bool) {
        return handler.hasOutcome();
    }

    function _totalExcluded() internal view returns (uint256 sum) {
        for (uint256 i; i < handler.bidderCount(); ++i) {
            sum += auction.excluded(handler.bidders(i));
        }
    }

    /// @dev Handler-side checks: pause, rescue mode, rescuer powers, screening and claim-once.
    function invariant_handlerChecks() public view {
        assertEq(handler.failure(), "");
    }

    /// @dev What the auction still has to pay, from the deposits, the claimed flags and the settlement split: every
    /// deposit and all funding until the phase is final, then each unclaimed share and the unclaimed treasury legs.
    /// Excluded balances are unpaid in every phase.
    function _unpaid() internal view returns (uint256 bidUnpaid, uint256 fillUnpaid) {
        bidUnpaid = _totalExcluded();
        if (!_settled()) return (bidUnpaid + auction.totalDeposits(), handler.funded() - handler.excessWithdrawn());
        IFixedPriceAuction.Settlement memory s = auction.settlement();
        for (uint256 i; i < handler.bidderCount(); ++i) {
            address account = handler.bidders(i);
            uint256 amount = auction.deposits(account);
            if (amount == 0 || auction.claimed(account)) continue;
            bidUnpaid += Math.mulDiv(amount, s.userRefund, auction.totalDeposits());
            fillUnpaid += Math.mulDiv(amount, s.userFill, auction.totalDeposits());
        }
        if (!auction.treasuryClaimed()) {
            bidUnpaid += s.filledBids;
            fillUnpaid += s.funderRefund;
        }
    }

    /// @dev The auction's balance less the stray transfers still held is what came in less what was paid out, and
    /// covers everything unpaid.
    function invariant_balancesCoverOwed() public view {
        uint256 bidHeld = bid.balanceOf(address(auction)) - handler.strayBid();
        uint256 fillHeld = fill.balanceOf(address(auction)) - handler.strayFill();
        assertEq(
            bidHeld,
            auction.totalDeposits() + _totalExcluded() - handler.userRefundPaid() - handler.treasuryBidPaid(),
            "bid held != books"
        );
        assertEq(
            fillHeld,
            handler.funded() - handler.excessWithdrawn() - handler.userFillPaid() - handler.treasuryFillPaid(),
            "fill held != books"
        );
        (uint256 bidUnpaid, uint256 fillUnpaid) = _unpaid();
        assertGe(bidHeld, bidUnpaid, "bid held < unpaid");
        assertGe(fillHeld, fillUnpaid, "fill held < unpaid");
    }

    /// @dev The payout counters match the books, so the balance above `liabilities()` is exactly the stray transfers
    /// still held: recovery can take those and nothing owed. With invariant_balancesCoverOwed, liabilities cover every
    /// unpaid claim and excluded balance.
    function invariant_liabilitiesAreBalanceLessStray() public view {
        assertEq(auction.totalExcluded(), _totalExcluded(), "totalExcluded != sum of excluded");
        assertEq(auction.bidPaid(), handler.userRefundPaid() + handler.treasuryBidPaid(), "bidPaid != books");
        assertEq(auction.fillPaid(), handler.userFillPaid() + handler.treasuryFillPaid(), "fillPaid != books");
        (uint256 bidOwed, uint256 fillOwed) = auction.liabilities();
        assertEq(bid.balanceOf(address(auction)) - bidOwed, handler.strayBid(), "bid balance - liabilities != stray");
        assertEq(
            fill.balanceOf(address(auction)) - fillOwed, handler.strayFill(), "fill balance - liabilities != stray"
        );
    }

    /// @dev totalDeposits is the sum of deposits.
    function invariant_totalDepositsIsSumOfDeposits() public view {
        uint256 sum;
        for (uint256 i; i < handler.bidderCount(); ++i) {
            sum += auction.deposits(handler.bidders(i));
        }
        assertEq(auction.totalDeposits(), sum);
    }

    /// @dev `funding` is what was funded less the excess withdrawn, always: claims never move it.
    function invariant_fundingMatchesBooks() public view {
        assertEq(auction.funding(), handler.funded() - handler.excessWithdrawn(), "funding != funded - withdrawn");
    }

    /// @dev Once final, what's held covers every remaining claim and excluded balance, with at most a wei per
    /// claimant over.
    function invariant_owedCoversClaims() public view {
        if (!_settled()) return;
        uint256 bidNeeded = _totalExcluded();
        uint256 fillNeeded;
        uint256 claimants;
        for (uint256 i; i < handler.bidderCount(); ++i) {
            address account = handler.bidders(i);
            if (auction.deposits(account) > 0) ++claimants;
            IFixedPriceAuction.UserClaim memory c = auction.claimable(account);
            bidNeeded += c.refund;
            fillNeeded += c.fill;
        }
        IFixedPriceAuction.TreasuryClaim memory t = auction.treasuryClaimable();
        bidNeeded += t.proceeds;
        fillNeeded += t.funderRefund;

        uint256 bidHeld = bid.balanceOf(address(auction)) - handler.strayBid();
        uint256 fillHeld = fill.balanceOf(address(auction)) - handler.strayFill();
        assertGe(bidHeld, bidNeeded, "bid held < claimable");
        assertGe(fillHeld, fillNeeded, "fill held < claimable");
        assertLe(bidHeld - bidNeeded, claimants, "bid surplus > claimants");
        assertLe(fillHeld - fillNeeded, claimants, "fill surplus > claimants");
    }

    /// @dev The settlement maths, on `settlement()`, live before the phase is final and fixed after.
    function invariant_settlementMaths() public view {
        IFixedPriceAuction.Settlement memory s = auction.settlement();
        uint256 fundingHeld = handler.funded() - handler.excessWithdrawn();
        uint256 total = auction.totalDeposits();
        uint256 denominator = 10 ** (18 + uint256(bid.decimals()) - fill.decimals());

        // The split adds up.
        assertLe(s.filledBids, total, "filled > total");
        assertEq(s.userRefund, total - s.filledBids, "userRefund != total - filled");
        assertEq(s.funderRefund, fundingHeld - s.userFill, "funderRefund != funding - userFill");
        // Bidders never get more than their filled deposits buy.
        assertLe(s.userFill, s.filledBids.mulDivRound(price, denominator, false), "userFill > filled value");
        // Bidders pay only for the fill tokens they get: filled bids are the rounded-up cost of userFill.
        assertEq(s.filledBids, s.userFill.mulDivRound(denominator, price, true), "filled != cost of userFill");
        // Full funding buys the whole fill-token wei of every deposit, and the refund is worth under one fill wei.
        if (
            auction.phase() == IFixedPriceAuction.Phase.Settlement
                && fundingHeld >= total.mulDivRound(price, denominator, true)
        ) {
            assertEq(s.userFill, total.mulDivRound(price, denominator, false), "full funding short of fill");
            assertEq(s.userRefund.mulDivRound(price, denominator, false), 0, "full funding refunded a fill wei");
        }
        // No fill tokens, no bid tokens taken.
        if (s.userFill == 0) assertEq(s.filledBids, 0, "bid tokens filled for no fill tokens");
    }

    /// @dev From `fulfillmentEnd` the phase is final. Once final, by the clock or a call, it and the settlement never
    /// change, and settledAt changes at most once: from 0 to `fulfillmentEnd` after a settlement by the clock.
    function invariant_outcomeFrozen() public view {
        if (block.timestamp >= auction.getConfig().fulfillmentEnd) {
            IFixedPriceAuction.Phase p = auction.phase();
            assertTrue(
                p == IFixedPriceAuction.Phase.Settlement || p == IFixedPriceAuction.Phase.Cancelled,
                "not final at fulfillmentEnd"
            );
        }
        if (!_settled()) return;
        assertEq(abi.encode(auction.settlement()), abi.encode(handler.frozenSettlement()), "settlement changed");
        // A clock settlement may later record fulfillmentEnd, once, via a claim or emitSettlement.
        if (auction.settledAt() != handler.ghostSettledAt()) {
            assertEq(handler.ghostSettledAt(), 0, "settledAt changed");
            assertEq(
                uint256(handler.ghostOutcome()), uint256(IFixedPriceAuction.Phase.Settlement), "settledAt on cancel"
            );
            assertEq(auction.settledAt(), auction.getConfig().fulfillmentEnd, "settledAt changed");
        }
        assertEq(uint256(auction.phase()), uint256(handler.ghostOutcome()), "outcome changed");
    }

    /// @dev `AuctionSettled` is emitted at most once, exactly when settledAt is set: by `settleEarly`, or for a
    /// settlement by the clock by the first claim or `emitSettlement`; `AuctionCancelled` exactly on cancel, once;
    /// never both. The handler checks each event's fields against the settlement.
    function invariant_outcomeEmittedOnce() public view {
        uint256 settled = handler.settledEvents();
        uint256 cancelled = handler.cancelledEvents();
        assertLe(settled, 1, "AuctionSettled emitted more than once");
        assertLe(cancelled, 1, "AuctionCancelled emitted more than once");
        assertTrue(settled == 0 || cancelled == 0, "both settled and cancelled");
        assertEq(settled == 1, auction.settledAt() != 0, "AuctionSettled not emitted exactly when settledAt is set");
        assertEq(
            cancelled == 1,
            auction.phase() == IFixedPriceAuction.Phase.Cancelled,
            "AuctionCancelled not emitted exactly when cancelled"
        );
    }

    /// @dev Under any order of handovers, the executor and the rescuer are two addresses, and the handler's view of
    /// who holds each role is right. Rescue mode leaves no executor proposal standing.
    function invariant_rolesStaySeparate() public view {
        assertTrue(auction.executor() != auction.rescuer(), "executor is the rescuer");
        assertEq(auction.executor(), handler.msig(), "executor moved outside a handover");
        assertEq(auction.rescuer(), handler.rescuer(), "rescuer moved outside a handover");
        if (auction.inRescueMode()) {
            assertEq(auction.proposedExecutor(), address(0), "executor proposal standing in rescue mode");
        }
    }

    /// @dev After a cancel, every unpaid bidder is owed exactly their deposit and no fill tokens, and the funder
    /// exactly the funding it left in.
    function invariant_cancelRefundsExactly() public view {
        if (auction.phase() != IFixedPriceAuction.Phase.Cancelled) return;
        for (uint256 i; i < handler.bidderCount(); ++i) {
            address account = handler.bidders(i);
            if (auction.claimed(account)) continue;
            IFixedPriceAuction.UserClaim memory c = auction.claimable(account);
            assertEq(c.refund, auction.deposits(account), "cancel doesn't refund the whole deposit");
            assertEq(c.fill, 0, "cancel pays fill tokens");
        }
        IFixedPriceAuction.Settlement memory s = auction.settlement();
        assertEq(s.funderRefund, handler.funded() - handler.excessWithdrawn(), "cancel doesn't refund all funding");
        if (!auction.treasuryClaimed()) {
            IFixedPriceAuction.TreasuryClaim memory t = auction.treasuryClaimable();
            assertEq(t.proceeds, 0, "cancel pays proceeds");
            assertEq(t.funderRefund, s.funderRefund, "cancel doesn't refund the funder");
        }
    }

    /// @dev The pointer is never zero; once disabled, it stays disabled and frozen.
    function invariant_compliancePointer() public view {
        assertTrue(auction.complianceCheck() != address(0), "zero pointer");
        if (handler.disabledSeen()) {
            assertTrue(auction.complianceDisabled(), "re-enabled");
            assertEq(auction.complianceCheck(), handler.frozenComplianceCheck(), "pointer moved");
        }
    }

    /// @dev Liveness: once every brake is lifted, every bidder and the treasury can claim, nothing reverts, and only
    /// rounding dust stays behind: under one wei per claimant per token.
    function afterInvariant() public {
        handler.drain();
        assertEq(handler.failure(), "");

        uint256 claimants;
        for (uint256 i; i < handler.bidderCount(); ++i) {
            address account = handler.bidders(i);
            if (auction.deposits(account) == 0) continue;
            ++claimants;
            assertTrue(auction.claimed(account), "bidder not paid out");
        }
        assertTrue(auction.treasuryClaimed(), "treasury not paid out");
        assertEq(_totalExcluded(), 0, "excluded balance not paid out");
        invariant_balancesCoverOwed();
        invariant_liabilitiesAreBalanceLessStray();
        invariant_outcomeEmittedOnce();
        // In Settlement with any claimant or the treasury paid, so the clock settlement's event has gone out.
        if (auction.phase() == IFixedPriceAuction.Phase.Settlement) {
            assertGt(auction.settledAt(), 0, "no AuctionSettled");
        }
        // A cancel refunds exactly, so it leaves no dust at all.
        uint256 maxDust = claimants == 0 || auction.phase() == IFixedPriceAuction.Phase.Cancelled ? 0 : claimants - 1;
        assertLe(bid.balanceOf(address(auction)) - handler.strayBid(), maxDust, "bid dust >= claimants");
        assertLe(fill.balanceOf(address(auction)) - handler.strayFill(), maxDust, "fill dust >= claimants");
    }

    /// @dev The run did something, judged at the end of a full run: deposits and claims succeeded whenever the run
    /// gave an eligible bidder the chance. A run that stays paused or flagged throughout has no chance to judge.
    function invariant_progress() public view {
        if (handler.calls() < 64) return;
        if (handler.depositChances() > 0) assertGt(handler.successes("deposit"), 0, "no deposit succeeded");
        if (handler.claimChances() > 0) assertGt(handler.successes("claim"), 0, "no claim succeeded");
    }
}

/// forge-config: default.invariant.runs = 64
/// forge-config: default.invariant.depth = 128
contract FixedPriceAuctionInvariantTest is FixedPriceAuctionInvariantBase {
    /// @dev 18-decimal TGLD for 18-decimal USDS at 0.0466.
    function _auctionConfig() internal pure override returns (uint8, uint8, uint256) {
        return (18, 18, PRICE);
    }
}

/// forge-config: default.invariant.runs = 64
/// forge-config: default.invariant.depth = 128
contract FixedPriceAuctionInvariantBid6Fill18Test is FixedPriceAuctionInvariantBase {
    /// @dev A USDC-style 6-decimal bid token buying an 18-decimal fill token at about 21.46 (1 / 0.0466).
    function _auctionConfig() internal pure override returns (uint8, uint8, uint256) {
        return (6, 18, 21.4592e18);
    }
}

/// forge-config: default.invariant.runs = 64
/// forge-config: default.invariant.depth = 128
contract FixedPriceAuctionInvariantBid18Fill6Test is FixedPriceAuctionInvariantBase {
    /// @dev An 18-decimal bid token buying a 6-decimal fill token at 0.0001, so one bid token buys 100 fill wei and
    /// rounding dust is material.
    function _auctionConfig() internal pure override returns (uint8, uint8, uint256) {
        return (18, 6, 0.0001e18);
    }

    /// @dev The fill token blocks addresses like USDC.
    function _blocklistFill() internal pure override returns (bool) {
        return true;
    }
}
