pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FakeERC20CustomDecimals } from "contracts/fakes/FakeERC20CustomDecimals.sol";
import { TempleMath } from "contracts/common/TempleMath.sol";

import { IFixedPriceAuction } from "contracts/interfaces/templegold/IFixedPriceAuction.sol";
import { ITempleElevatedAccess } from "contracts/interfaces/v2/access/ITempleElevatedAccess.sol";
import { ComplianceCheck } from "contracts/templegold/ComplianceCheck.sol";
import { FixedPriceAuctionTestBase } from "test/forge/unit/templegold/FixedPriceAuction.t.sol";
import { FixedPriceAuctionHandler } from "./handlers/FixedPriceAuctionHandler.sol";

/// @dev The suite, for one auction configuration. Each concrete contract below picks the decimals and price.
abstract contract FixedPriceAuctionInvariantBase is FixedPriceAuctionTestBase {
    using TempleMath for uint256;

    FixedPriceAuctionHandler internal handler;
    FakeERC20CustomDecimals internal bid;
    FakeERC20CustomDecimals internal fill;
    uint256 internal price;

    /// @dev The configuration under test: token decimals and the fixed price.
    function _auctionConfig() internal pure virtual returns (uint8 bidDecimals, uint8 fillDecimals, uint256 price_);

    function setUp() public override {
        super.setUp();
        (uint8 bidDecimals, uint8 fillDecimals, uint256 price_) = _auctionConfig();
        price = price_;
        bid = new FakeERC20CustomDecimals("Bid", "BID", address(0), 0, bidDecimals);
        fill = new FakeERC20CustomDecimals("Fill", "FILL", address(0), 0, fillDecimals);
        auction = _create(_config(address(bid), address(fill), price, 100));
        ComplianceCheck compliance2 = new ComplianceCheck(executor);
        ITempleElevatedAccess.ExplicitAccess[] memory access = new ITempleElevatedAccess.ExplicitAccess[](1);
        access[0] = ITempleElevatedAccess.ExplicitAccess(ComplianceCheck.setBlocked.selector, true);
        vm.startPrank(executor);
        compliance.setExplicitAccess(blocker, access);
        compliance2.setExplicitAccess(blocker, access);
        vm.stopPrank();
        FakeERC20CustomDecimals stray = new FakeERC20CustomDecimals("Stray", "STRAY", address(0), 0, 18);

        handler = new FixedPriceAuctionHandler(auction, compliance, compliance2, stray, executor, rescuer, blocker);
        targetContract(address(handler));
        targetSelector(FuzzSelector({ addr: address(handler), selectors: _weightedSelectors() }));
    }

    // A repeated selector is picked more often. Time, deposits, funding and claims are weighted up.
    function _weightedSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](33);
        uint256 i;
        for (uint256 n; n < 5; ++n) {
            s[i++] = FixedPriceAuctionHandler.warp.selector;
        }
        for (uint256 n; n < 3; ++n) {
            s[i++] = FixedPriceAuctionHandler.deposit.selector;
        }
        for (uint256 n; n < 5; ++n) {
            s[i++] = FixedPriceAuctionHandler.claim.selector;
        }
        for (uint256 n; n < 2; ++n) {
            s[i++] = FixedPriceAuctionHandler.claimTreasury.selector;
        }
        for (uint256 n; n < 4; ++n) {
            s[i++] = FixedPriceAuctionHandler.fund.selector;
        }
        s[i++] = FixedPriceAuctionHandler.withdrawDeposit.selector;
        s[i++] = FixedPriceAuctionHandler.withdrawExcess.selector;
        s[i++] = FixedPriceAuctionHandler.endFulfillment.selector;
        s[i++] = FixedPriceAuctionHandler.cancel.selector;
        s[i++] = FixedPriceAuctionHandler.recoverToken.selector;
        s[i++] = FixedPriceAuctionHandler.setPausedByMsig.selector;
        s[i++] = FixedPriceAuctionHandler.setComplianceCheck.selector;
        s[i++] = FixedPriceAuctionHandler.setPausedByRescuer.selector;
        s[i++] = FixedPriceAuctionHandler.setRescueMode.selector;
        s[i++] = FixedPriceAuctionHandler.cancelByRescuer.selector;
        s[i++] = FixedPriceAuctionHandler.disableComplianceCheck.selector;
        s[i++] = FixedPriceAuctionHandler.rescuerOverreach.selector;
        s[i++] = FixedPriceAuctionHandler.setBlocked.selector;
        s[i++] = FixedPriceAuctionHandler.strayTransfer.selector;
    }

    function _settled() internal view returns (bool) {
        return handler.hasOutcome();
    }

    /// @dev Handler-side checks: pause, rescue mode, rescuer powers, screening and claim-once.
    function invariant_handlerChecks() public view {
        assertEq(handler.failure(), "");
    }

    /// @dev The auction holds what it owes, plus exactly the stray transfers not yet recovered.
    function invariant_balancesCoverOwed() public view {
        uint256 bidBalance = bid.balanceOf(address(auction));
        uint256 fillBalance = fill.balanceOf(address(auction));
        assertGe(bidBalance, auction.bidOwed(), "bid balance < bidOwed");
        assertGe(fillBalance, auction.fillOwed(), "fill balance < fillOwed");
        assertEq(bidBalance - handler.strayBid(), auction.bidOwed(), "bid balance - stray != bidOwed");
        assertEq(fillBalance - handler.strayFill(), auction.fillOwed(), "fill balance - stray != fillOwed");
    }

    /// @dev totalDeposits is the sum of deposits.
    function invariant_totalDepositsIsSumOfDeposits() public view {
        uint256 sum;
        for (uint256 i; i < handler.bidderCount(); ++i) {
            sum += auction.deposits(handler.bidders(i));
        }
        assertEq(auction.totalDeposits(), sum);
    }

    /// @dev Before an outcome, owed is what was deposited and funded. At any time, owed falls by exactly what's paid.
    function invariant_owedMatchesBooks() public view {
        if (!_settled()) {
            assertEq(auction.bidOwed(), auction.totalDeposits(), "bidOwed != totalDeposits before outcome");
            assertEq(
                auction.fillOwed(),
                handler.funded() - handler.excessWithdrawn(),
                "fillOwed != funding held before outcome"
            );
        }
        assertEq(
            auction.bidOwed(),
            auction.totalDeposits() - handler.userRefundPaid() - handler.treasuryBidPaid(),
            "bidOwed != deposits - paid"
        );
        assertEq(
            auction.fillOwed(),
            handler.funded() - handler.excessWithdrawn() - handler.userFillPaid() - handler.treasuryFillPaid(),
            "fillOwed != funding - paid"
        );
    }

    /// @dev After an outcome, what's owed covers every remaining claim, with at most a wei per claimant over.
    function invariant_owedCoversClaims() public view {
        if (!_settled()) return;
        uint256 bidNeeded;
        uint256 fillNeeded;
        uint256 claimants;
        for (uint256 i; i < handler.bidderCount(); ++i) {
            address account = handler.bidders(i);
            if (auction.deposits(account) > 0) ++claimants;
            IFixedPriceAuction.UserClaim memory c = auction.claimable(account);
            bidNeeded += c.bidTokenRefund;
            fillNeeded += c.fillTokenAmount;
        }
        IFixedPriceAuction.TreasuryClaim memory t = auction.treasuryClaimable();
        bidNeeded += t.bidTokenAmount;
        fillNeeded += t.fillTokenRefund;

        assertGe(auction.bidOwed(), bidNeeded, "bidOwed < claimable");
        assertGe(auction.fillOwed(), fillNeeded, "fillOwed < claimable");
        assertLe(auction.bidOwed() - bidNeeded, claimants, "bid surplus > claimants");
        assertLe(auction.fillOwed() - fillNeeded, claimants, "fill surplus > claimants");
    }

    /// @dev The settlement maths, on the snapshot after an outcome and on the live preview before.
    function invariant_settlementMaths() public view {
        IFixedPriceAuction.Settlement memory s = auction.previewSettlement();
        uint256 fundingHeld = handler.funded() - handler.excessWithdrawn();
        uint256 total = auction.totalDeposits();
        uint256 denominator = auction.priceDenominator();

        // The split adds up.
        assertLe(s.filledDeposits, total, "filled > total");
        assertEq(s.userRefund, total - s.filledDeposits, "userRefund != total - filled");
        assertEq(s.funderRefund, fundingHeld - s.userFunding, "funderRefund != funding - userFunding");
        // Bidders never get more than their filled deposits buy.
        assertLe(s.userFunding, s.filledDeposits.mulDivRound(price, denominator, false), "userFunding > filled value");
        // Full funding fills everything, unless all deposits together buy under one fill wei (then the zero-fill
        // guard wins).
        if (
            auction.phase() == IFixedPriceAuction.Phase.Settled
                && fundingHeld >= total.mulDivRound(price, denominator, true)
                && total.mulDivRound(price, denominator, false) > 0
        ) assertEq(s.filledDeposits, total, "full funding didn't fill everything");
        // No fill tokens, no bid tokens taken.
        if (s.userFunding == 0) assertEq(s.filledDeposits, 0, "bid tokens filled for no fill tokens");
    }

    /// @dev The outcome, its snapshot and settledAt never change once set.
    function invariant_outcomeFrozen() public view {
        if (!_settled()) return;
        assertEq(abi.encode(auction.previewSettlement()), abi.encode(handler.snapshot()), "snapshot changed");
        assertEq(auction.settledAt(), handler.ghostSettledAt(), "settledAt changed");
        assertEq(uint256(auction.phase()), uint256(handler.ghostOutcome()), "outcome changed");
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
        invariant_balancesCoverOwed();
        uint256 maxDust = claimants == 0 ? 0 : claimants - 1;
        assertLe(auction.bidOwed(), maxDust, "bid dust >= claimants");
        assertLe(auction.fillOwed(), maxDust, "fill dust >= claimants");
    }

    /// @dev The run did something, judged at the end of a full run: deposits and claims succeeded whenever the run
    /// gave an eligible bidder the chance. A run that stays paused or blocked throughout has no chance to judge.
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
}
