pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Test } from "forge-std/Test.sol";
import { Vm } from "forge-std/Vm.sol";
import { FakeERC20CustomDecimals } from "contracts/fakes/FakeERC20CustomDecimals.sol";
import { FakeBlocklistERC20 } from "./FakeBlocklistERC20.sol";
import { TempleMath } from "contracts/common/TempleMath.sol";

import { IFixedPriceAuction } from "contracts/interfaces/templegold/IFixedPriceAuction.sol";
import { IComplianceCheck } from "contracts/interfaces/templegold/IComplianceCheck.sol";
import { FixedPriceAuction } from "contracts/templegold/FixedPriceAuction.sol";
import { ComplianceCheck } from "contracts/templegold/ComplianceCheck.sol";

/// @dev Drives one auction through random, bounded actions and keeps ghost books of everything paid. Checks that
/// only make sense at the moment of an action run here and record the first failure: pause, rescue mode, rescuer
/// powers, screening and claim-once.
contract FixedPriceAuctionHandler is Test {
    using TempleMath for uint256;

    struct State {
        uint256 bidBalance;
        uint256 fillBalance;
        uint256 strayBalance;
        uint256 totalDeposits;
        uint256 totalExcluded;
        uint256 funding;
        bool paused;
        bool inRescueMode;
        bool complianceDisabled;
        address complianceCheck;
        address executor;
        address rescuer;
        IFixedPriceAuction.Phase phase;
        uint64 settledAt;
    }

    FixedPriceAuction public immutable auction;
    FakeERC20CustomDecimals public immutable bid;
    FakeERC20CustomDecimals public immutable fill;
    FakeERC20CustomDecimals public immutable stray;
    ComplianceCheck public immutable compliance;
    ComplianceCheck public immutable compliance2;
    /// @dev The current executor and rescuer. Handovers move them.
    address public msig;
    address public rescuer;
    /// @dev Who handovers pass either role to: shared and including both initial holders, so a handover can try to
    /// give both roles to one address.
    address[5] internal roleCandidates;
    /// @dev Granted `setFlagged` on both lists.
    address public immutable flagger;
    address public immutable outsider = makeAddr("outsider");
    address[4] public bidders;
    /// @dev The auction's config as created. `complianceCheck` here is the initial pointer only.
    IFixedPriceAuction.AuctionConfig internal config;
    uint256 internal constant MIN_DEPOSIT_PHASE_CALLS = 12;
    uint256 internal constant MIN_FULFILLMENT_PHASE_CALLS = 12;
    /// @dev A billion bid tokens, in bid-token wei.
    uint256 internal immutable maxDeposit;
    /// @dev A little over full funding for one max deposit per bidder.
    uint256 internal immutable maxFund;

    uint256 public currentTime;
    uint256 public calls;
    /// @dev Calls made during the deposit phase. `warp` won't jump to `depositEnd` until there are enough.
    uint256 public depositPhaseCalls;
    uint256 public fulfillmentPhaseCalls;
    mapping(string action => uint256 count) public successes;
    /// @dev Attempts made while the call should succeed: an unpaused, unflagged, eligible account in the right phase.
    uint256 public depositChances;
    uint256 public claimChances;

    uint256 internal fundCalls;
    bool internal partialRun;

    // Ghost books
    uint256 public funded;
    uint256 public excessWithdrawn;
    uint256 public userFillPaid;
    uint256 public userRefundPaid;
    uint256 public treasuryBidPaid;
    uint256 public treasuryFillPaid;
    mapping(address account => bool claimed) public ghostClaimed;
    bool public ghostTreasuryClaimed;
    uint256 public strayBid;
    uint256 public strayFill;
    uint256 public strayOther;

    // Frozen once the phase is first Settlement or Cancelled, by the clock or a call
    bool public hasOutcome;
    IFixedPriceAuction.Settlement internal _frozenSettlement;
    uint64 public ghostSettledAt;
    IFixedPriceAuction.Phase public ghostOutcome;

    /// @dev Bidders blocked at the fill-token level. Only set when the fill token is a FakeBlocklistERC20.
    mapping(address account => bool blocked) public fillTokenBlocked;

    // Outcome events seen from the auction
    uint256 public settledEvents;
    uint256 public cancelledEvents;

    // Compliance
    bool public disabledSeen;
    address public frozenComplianceCheck;

    string public failure;

    constructor(
        FixedPriceAuction auction_,
        ComplianceCheck compliance_,
        ComplianceCheck compliance2_,
        FakeERC20CustomDecimals stray_,
        address msig_,
        address rescuer_,
        address flagger_
    ) {
        auction = auction_;
        config = auction_.getConfig();
        bid = FakeERC20CustomDecimals(config.bidToken);
        fill = FakeERC20CustomDecimals(config.fillToken);
        stray = stray_;
        compliance = compliance_;
        compliance2 = compliance2_;
        msig = msig_;
        rescuer = rescuer_;
        roleCandidates = [makeAddr("candidate0"), makeAddr("candidate1"), makeAddr("candidate2"), msig_, rescuer_];
        flagger = flagger_;
        bidders = [makeAddr("bidder0"), makeAddr("bidder1"), makeAddr("bidder2"), makeAddr("bidder3")];
        currentTime = block.timestamp;
        maxDeposit = 1e9 * 10 ** bid.decimals();
        maxFund = (4 * maxDeposit).mulDivRound(config.price, auction_.priceDenominator(), true) * 107 / 100 + 1;
    }

    modifier step() {
        vm.warp(currentTime);
        ++calls;
        IFixedPriceAuction.Phase current = auction.phase();
        if (current == IFixedPriceAuction.Phase.Deposit) ++depositPhaseCalls;
        else if (current == IFixedPriceAuction.Phase.Fulfillment) ++fulfillmentPhaseCalls;
        vm.recordLogs();
        _;
        _countOutcomeEvents();
        _recordOutcome();
    }

    /****** BIDDERS ******/

    function deposit(uint256 seed, uint256 amount) external step {
        address account = bidders[seed % 4];
        amount = _bound(amount, 1, maxDeposit);
        bid.mint(account, amount);
        vm.prank(account);
        bid.approve(address(auction), amount);

        (State memory before, bool flagged, uint256 deposit_, bool claimed_) = _pre(account);
        if (
            before.phase == IFixedPriceAuction.Phase.Deposit && !before.paused && !flagged
                && deposit_ + amount >= config.minDeposit
        ) ++depositChances;
        vm.prank(account);
        bool ok;
        try auction.deposit(amount) {
            ok = true;
            ++successes["deposit"];
        } catch {}
        _post(account, ok, before, flagged, deposit_, claimed_);
        _checkPhase(ok, before.phase, IFixedPriceAuction.Phase.Deposit, "deposit outside Deposit");
    }

    function withdrawDeposit(uint256 seed, uint256 amount) external step {
        address account = bidders[seed % 4];
        uint256 held = auction.deposits(account);
        amount = _bound(amount, 1, held == 0 ? 1 : held);

        (State memory before, bool flagged, uint256 deposit_, bool claimed_) = _pre(account);
        vm.prank(account);
        bool ok;
        try auction.withdrawDeposit(amount) {
            ok = true;
            ++successes["withdrawDeposit"];
        } catch {}
        _post(account, ok, before, flagged, deposit_, claimed_);
        _checkPhase(ok, before.phase, IFixedPriceAuction.Phase.Deposit, "withdrawDeposit outside Deposit");
    }

    function claim(uint256 seed) external step {
        address account = bidders[seed % 4];
        IFixedPriceAuction.UserClaim memory expected = auction.claimable(account);
        uint256 fillBefore = fill.balanceOf(account);
        uint256 bidBefore = bid.balanceOf(account);

        (State memory before, bool flagged, uint256 deposit_, bool claimed_) = _pre(account);
        // A fill token that blocks the account blocks the whole claim, refund leg included.
        bool tokenBlocked = fillTokenBlocked[account] && expected.fill > 0;
        if (
            (before.phase == IFixedPriceAuction.Phase.Settlement || before.phase == IFixedPriceAuction.Phase.Cancelled)
                && !before.paused && !flagged && !tokenBlocked && deposit_ > 0 && !claimed_
        ) ++claimChances;
        vm.prank(account);
        bool ok;
        try auction.claim() {
            ok = true;
            ++successes["claim"];
        } catch {
            _discardLogs();
        }
        _post(account, ok, before, flagged, deposit_, claimed_);
        _check(!ok || _final(before.phase), "claim before an outcome");
        _checkClockSettlementRecorded(ok, before);
        if (tokenBlocked) _check(!ok, "claim paid fill tokens to a token-blocked account");
        if (ok) _bookClaim(account, expected, fillBefore, bidBefore);
    }

    function _bookClaim(
        address account,
        IFixedPriceAuction.UserClaim memory expected,
        uint256 fillBefore,
        uint256 bidBefore
    ) internal {
        _check(!ghostClaimed[account], "account claimed twice");
        ghostClaimed[account] = true;
        uint256 gotFill = fill.balanceOf(account) - fillBefore;
        uint256 gotBid = bid.balanceOf(account) - bidBefore;
        // `claimable` is a preview of what `claim` pays.
        _check(gotFill == expected.fill && gotBid == expected.refund, "claim != claimable");
        userFillPaid += gotFill;
        userRefundPaid += gotBid;
    }

    /****** EXCLUSION ******/

    /// @dev Prefers a bidder with a deposit, flagged if possible, and half the time flags it first, so exclusions
    /// happen often. The caller is the msig, the flagger (granted `setFlagged` on both lists), an outsider or the
    /// rescuer (always refused).
    function exclude(uint256 seed, uint256 by) external step {
        address account = _pickFlagged(seed);
        if ((seed >> 8) % 2 == 0) _flag(account, true);
        address caller = [msig, flagger, outsider, rescuer][by % 4];
        (State memory before, bool flagged, uint256 deposit_,) = _pre(account);
        uint256 excludedBefore = auction.excluded(account);
        uint256[4] memory others = _deposits();

        vm.prank(caller);
        bool ok;
        try auction.exclude(account) {
            ok = true;
            ++successes["exclude"];
        } catch {}
        bool open = before.phase == IFixedPriceAuction.Phase.Deposit
            || before.phase == IFixedPriceAuction.Phase.Fulfillment;
        // Paused or not.
        bool allowed = _mayExclude(caller, before) && open && flagged && deposit_ > 0;
        _check(ok == allowed, "exclude not exactly when allowed");
        if (!ok) {
            _check(_same(before, _state()), "failed exclude changed state");
            return;
        }
        _check(
            auction.deposits(account) == 0 && auction.excluded(account) == excludedBefore + deposit_
                && auction.totalDeposits() == before.totalDeposits - deposit_,
            "exclude didn't move exactly the deposit"
        );
        _checkOnlyMoved(account, others, before, "exclude");
    }

    /// @dev Prefers an unflagged bidder with an excluded balance, and half the time unflags it first. Callers as for
    /// `exclude`.
    function reinstate(uint256 seed, uint256 by) external step {
        address account = _pickExcluded(seed);
        if ((seed >> 8) % 2 == 0) _flag(account, false);
        address caller = [msig, flagger, outsider, rescuer][by % 4];
        (State memory before, bool flagged, uint256 deposit_,) = _pre(account);
        uint256 excluded_ = auction.excluded(account);
        uint256[4] memory others = _deposits();

        vm.prank(caller);
        bool ok;
        try auction.reinstate(account) {
            ok = true;
            ++successes["reinstate"];
        } catch {}
        // Deposits are bounded, so the overflow guard never trips here.
        _check(
            ok == (_mayExclude(caller, before) && before.phase == IFixedPriceAuction.Phase.Deposit && !flagged
                && excluded_ > 0),
            "reinstate not exactly when allowed"
        );
        if (!ok) {
            _check(_same(before, _state()), "failed reinstate changed state");
            return;
        }
        _check(
            auction.deposits(account) == deposit_ + excluded_ && auction.excluded(account) == 0
                && auction.totalDeposits() == before.totalDeposits + excluded_,
            "reinstate didn't move exactly the excluded balance"
        );
        _checkOnlyMoved(account, others, before, "reinstate");
    }

    /// @dev Prefers an unflagged bidder with an excluded balance, and half the time unflags it first.
    function withdrawExcluded(uint256 seed) external step {
        address account = _pickExcluded(seed);
        if ((seed >> 8) % 2 == 0) _flag(account, false);
        uint256 excluded_ = auction.excluded(account);
        uint256 bidBefore = bid.balanceOf(account);
        (State memory before, bool flagged, uint256 deposit_, bool claimed_) = _pre(account);

        vm.prank(account);
        bool ok;
        try auction.withdrawExcluded() {
            ok = true;
            ++successes["withdrawExcluded"];
        } catch {}
        _post(account, ok, before, flagged, deposit_, claimed_);
        _check(ok == (!before.paused && !flagged && excluded_ > 0), "withdrawExcluded not exactly when allowed");
        if (!ok) {
            _check(auction.excluded(account) == excluded_, "failed withdrawExcluded moved the balance");
            return;
        }
        _check(
            bid.balanceOf(account) - bidBefore == excluded_ && auction.excluded(account) == 0,
            "withdrawExcluded didn't pay exactly the excluded balance"
        );
        _check(auction.totalDeposits() == before.totalDeposits, "withdrawExcluded moved deposits");
    }

    /// @dev Outside rescue mode: the executor, or the flagger, whose grant is on both lists, while compliance is
    /// enabled.
    function _mayExclude(address caller, State memory before) internal view returns (bool) {
        return !before.inRescueMode && (caller == msig || (caller == flagger && !before.complianceDisabled));
    }

    /// @dev Exclusion moves no tokens, leaves funding alone and touches no other bidder's deposit.
    function _checkOnlyMoved(
        address account,
        uint256[4] memory depositsBefore,
        State memory before,
        string memory what
    ) internal {
        for (uint256 i; i < 4; ++i) {
            if (bidders[i] == account) continue;
            _check(auction.deposits(bidders[i]) == depositsBefore[i], string.concat(what, " moved another deposit"));
        }
        _check(
            bid.balanceOf(address(auction)) == before.bidBalance
                && fill.balanceOf(address(auction)) == before.fillBalance && auction.funding() == before.funding,
            string.concat(what, " moved tokens")
        );
    }

    function _deposits() internal view returns (uint256[4] memory d) {
        for (uint256 i; i < 4; ++i) {
            d[i] = auction.deposits(bidders[i]);
        }
    }

    /// @dev Three times in four, the first bidder from `seed` with a deposit, preferring flagged ones.
    function _pickFlagged(uint256 seed) internal view returns (address fallback_) {
        fallback_ = bidders[seed % 4];
        if (seed % 4 == 0) return fallback_;
        bool found;
        for (uint256 i; i < 4; ++i) {
            address account = bidders[(seed + i) % 4];
            if (auction.deposits(account) == 0) continue;
            if (_flagged(account)) return account;
            if (!found) (found, fallback_) = (true, account);
        }
    }

    /// @dev Three times in four, the first bidder from `seed` with an excluded balance, preferring unflagged ones.
    function _pickExcluded(uint256 seed) internal view returns (address fallback_) {
        fallback_ = bidders[seed % 4];
        if (seed % 4 == 0) return fallback_;
        bool found;
        for (uint256 i; i < 4; ++i) {
            address account = bidders[(seed + i) % 4];
            if (auction.excluded(account) == 0) continue;
            if (!_flagged(account)) return account;
            if (!found) (found, fallback_) = (true, account);
        }
    }

    function _flagged(address account) internal view returns (bool) {
        return !auction.complianceDisabled() && IComplianceCheck(auction.complianceCheck()).isFlagged(account);
    }

    /****** FUNDER ******/

    function fund(uint256 amount) external step {
        // Steers runs onto the funded settlement path. Half the time exactly the shortfall to full funding, a quarter
        // of the time half of it, otherwise random. One run in five, fixed at its first fund call, only ever funds
        // half the shortfall, so it settles partly filled.
        uint256 required = auction.totalDeposits().mulDivRound(config.price, auction.priceDenominator(), true);
        uint256 shortfall = required > auction.funding() ? required - auction.funding() : 0;
        if (fundCalls++ == 0) partialRun = amount % 5 == 0;
        uint256 mode = partialRun ? 2 : amount % 4;
        if (mode < 2 && shortfall > 0) amount = shortfall;
        else if (mode == 2 && shortfall > 1) amount = shortfall / 2;
        else amount = _bound(amount, 1, maxFund);
        address funder = config.funder;
        fill.mint(funder, amount);
        vm.prank(funder);
        fill.approve(address(auction), amount);

        State memory before = _state();
        vm.prank(funder);
        bool ok;
        try auction.fund(amount) {
            ok = true;
            ++successes["fund"];
            funded += amount;
        } catch {}
        _checkPaused(ok, before);
        _checkPhase(ok, before.phase, IFixedPriceAuction.Phase.Fulfillment, "fund outside Fulfillment");
        // Never screened: the funder's own flag status can't stop it.
        _check(ok || before.paused || before.phase != IFixedPriceAuction.Phase.Fulfillment, "fund refused while open");
    }

    function withdrawExcess(uint256 seed, uint256 amount) external step {
        uint256 view_ = auction.withdrawableExcess();
        // Half the time exactly the view, otherwise one wei more or a random amount.
        uint256 mode = seed % 4;
        if (mode < 2) amount = view_;
        else if (mode == 2) amount = view_ + 1;
        else amount = _bound(amount, 1, maxFund);
        if (amount == 0) amount = 1;

        State memory before = _state();
        bool fullBefore = auction.settlement().filledBids == before.totalDeposits;
        vm.prank(config.funder);
        bool ok;
        try auction.withdrawExcess(amount) {
            ok = true;
            ++successes["withdrawExcess"];
            excessWithdrawn += amount;
        } catch {}
        _checkPaused(ok, before);
        _checkPhase(ok, before.phase, IFixedPriceAuction.Phase.Fulfillment, "withdrawExcess outside Fulfillment");
        // The view is zero whenever the call must revert (paused or outside Fulfillment), and amount is never zero.
        _check(ok == (amount <= view_), "withdrawExcess disagrees with withdrawableExcess");
        if (ok && fullBefore && amount == view_) {
            _check(
                auction.settlement().filledBids == before.totalDeposits,
                "withdrawing the excess left deposits unfilled"
            );
            // Recomputed here, so a rounding slip shared by the view and the settlement still shows.
            _check(
                auction.funding() * auction.priceDenominator() >= before.totalDeposits * config.price,
                "withdrawing the excess left funding short of every deposit"
            );
        }
    }

    function claimTreasury() external step {
        uint256 bidBefore = bid.balanceOf(config.proceedsRecipient);
        uint256 fillBefore = fill.balanceOf(config.funder);

        bool claimedBefore = auction.treasuryClaimed();
        State memory before = _state();
        vm.prank(outsider);
        bool ok;
        try auction.claimTreasury() {
            ok = true;
            ++successes["claimTreasury"];
        } catch {
            _discardLogs();
        }
        _checkPaused(ok, before);
        _check(!ok || _final(before.phase), "claimTreasury before an outcome");
        _checkClockSettlementRecorded(ok, before);
        // Never screened: whoever calls, and whatever the treasury addresses' flag status, it pays once due.
        _check(ok || before.paused || !_final(before.phase) || claimedBefore, "claimTreasury refused while due");
        if (ok) _bookTreasuryClaim(bidBefore, fillBefore);
    }

    function _bookTreasuryClaim(uint256 bidBefore, uint256 fillBefore) internal {
        _check(!ghostTreasuryClaimed, "treasury claimed twice");
        ghostTreasuryClaimed = true;
        treasuryBidPaid += bid.balanceOf(config.proceedsRecipient) - bidBefore;
        treasuryFillPaid += fill.balanceOf(config.funder) - fillBefore;
    }

    /// @dev Anyone may emit `AuctionSettled` for a settlement by the clock, exactly in Settlement while no event has gone
    /// out (settledAt still 0). Pause, rescue mode and the compliance lists don't stop it.
    function emitSettlement() external step {
        State memory before = _state();
        vm.prank(outsider);
        bool ok;
        try auction.emitSettlement() {
            ok = true;
            ++successes["emitSettlement"];
        } catch {}
        _check(
            ok == (before.phase == IFixedPriceAuction.Phase.Settlement && before.settledAt == 0),
            "emitSettlement not exactly once after a clock settlement"
        );
        if (ok) _check(auction.settledAt() == config.fulfillmentEnd, "emitSettlement didn't record fulfillmentEnd");
    }

    /// @dev In Settlement, a successful claim leaves settledAt set: from `settleEarly`, or `fulfillmentEnd` recorded by
    /// this or an earlier claim or `emitSettlement`.
    function _checkClockSettlementRecorded(bool ok, State memory before) internal {
        if (!ok || before.phase != IFixedPriceAuction.Phase.Settlement) return;
        _check(
            auction.settledAt() == (before.settledAt == 0 ? config.fulfillmentEnd : before.settledAt),
            "claim after a clock settlement didn't record fulfillmentEnd once"
        );
    }

    /****** MSIG ******/

    function settleEarly(uint256 seed) external step {
        // Gated on a hashed seed: about one call in four tries once something is funded, one in 32 before (an
        // early end before funding fills nothing).
        if (uint256(keccak256(abi.encode(seed))) % (successes["fund"] == 0 ? 32 : 4) != 0) return;
        State memory before = _state();
        vm.prank(msig);
        bool ok;
        try auction.settleEarly() {
            ok = true;
            ++successes["settleEarly"];
        } catch {}
        _checkRescueMode(ok, before);
        _checkPhase(ok, before.phase, IFixedPriceAuction.Phase.Fulfillment, "settleEarly outside Fulfillment");
        // Pause doesn't stop it: outside rescue mode it works whenever the auction is in Fulfillment.
        _check(
            ok || before.inRescueMode || before.phase != IFixedPriceAuction.Phase.Fulfillment,
            "settleEarly refused in Fulfillment"
        );
    }

    function cancel(uint256 seed) external step {
        // Gated on a hashed seed, so about one call in sixteen tries to cancel.
        if (uint256(keccak256(abi.encode(seed))) % 16 != 0) return;
        State memory before = _state();
        vm.prank(msig);
        bool ok;
        try auction.cancel() {
            ok = true;
            ++successes["cancel"];
        } catch {}
        _checkRescueMode(ok, before);
        // Pause doesn't stop it: outside rescue mode it works until an outcome or fulfillmentEnd.
        _check(ok == (!before.inRescueMode && !_final(before.phase)), "msig cancel not exactly while open");
    }

    function recoverToken(uint256 which, uint256 amount, bool exact) external step {
        FakeERC20CustomDecimals token = which % 3 == 0 ? stray : which % 3 == 1 ? bid : fill;
        uint256 tally = token == stray ? strayOther : token == bid ? strayBid : strayFill;
        // Exactly the stray tally, or a random amount that's usually too much.
        amount = exact && tally > 0 ? tally : _bound(amount, 1, 1e27);
        // Only what was transferred in outside the auction's books is surplus, for any token.
        bool recoverable = amount <= tally;

        State memory before = _state();
        vm.prank(msig);
        bool ok;
        try auction.recoverToken(address(token), msig, amount) {
            ok = true;
            ++successes["recoverToken"];
        } catch {}
        // Checked before the books move, so an over-recovery is reported, not hidden by an underflow revert.
        _check(!ok || recoverable, "recoverToken took more than the stray");
        if (ok && recoverable) {
            if (token == stray) strayOther -= amount;
            else if (token == bid) strayBid -= amount;
            else strayFill -= amount;
        }
        _checkPaused(ok, before);
        _checkRescueMode(ok, before);
        if (!before.paused && !before.inRescueMode) _check(ok == recoverable, "recoverToken != recoverable");
    }

    /// @dev Pauses a quarter of the time and unpauses otherwise, so runs aren't mostly paused.
    function setPausedByMsig(uint256 seed) external step {
        bool value = seed % 4 == 0;
        State memory before = _state();
        vm.prank(msig);
        bool ok;
        try auction.setPaused(value) {
            ok = true;
            ++successes["setPausedByMsig"];
        } catch {}
        _check(ok != before.inRescueMode, "msig setPaused not exactly outside rescue mode");
    }

    /// @dev A third of the time it tries the zero address, which must revert.
    function setComplianceCheck(uint256 which) external step {
        address target = which % 3 == 0 ? address(0) : which % 3 == 1 ? address(compliance) : address(compliance2);
        State memory before = _state();
        vm.prank(msig);
        bool ok;
        try auction.setComplianceCheck(target) {
            ok = true;
            ++successes["setComplianceCheck"];
        } catch {}
        // Works while paused; refused in rescue mode, once disabled, and for the zero address.
        _check(
            ok == (!before.inRescueMode && !before.complianceDisabled && target != address(0)),
            "setComplianceCheck not exactly when allowed"
        );
    }

    /****** RESCUER ******/

    function setPausedByRescuer(uint256 seed) external step {
        bool value = seed % 4 == 0;
        State memory before = _state();
        vm.prank(rescuer);
        bool ok;
        try auction.setPaused(value) {
            ok = true;
            ++successes["setPausedByRescuer"];
        } catch {}
        // Only in rescue mode, and only the pause changes.
        _check(!ok || before.inRescueMode, "rescuer paused outside rescue mode");
        if (ok) before.paused = value;
        _check(_same(before, _state()), "rescuer setPaused changed more than the pause");
    }

    /// @dev Switches rescue mode on a quarter of the time and off otherwise, so runs aren't mostly locked.
    function setRescueMode(uint256 seed) external step {
        bool value = seed % 4 == 0;
        State memory before = _state();
        vm.prank(rescuer);
        bool ok;
        try auction.setRescueMode(value) {
            ok = true;
            ++successes["setRescueMode"];
        } catch {}
        _check(ok, "setRescueMode reverted for the rescuer");
        before.inRescueMode = value;
        _check(_same(before, _state()), "setRescueMode changed more than rescue mode");
    }

    function disableComplianceCheck(uint256 seed) external step {
        // Gated on a hashed seed, so about one call in sixteen disables screening.
        if (uint256(keccak256(abi.encode(seed))) % 16 != 0) return;
        State memory before = _state();
        vm.prank(rescuer);
        bool ok;
        try auction.disableComplianceCheck() {
            ok = true;
            ++successes["disableComplianceCheck"];
        } catch {}
        _check(ok, "disableComplianceCheck reverted for the rescuer");
        before.complianceDisabled = true;
        _check(_same(before, _state()), "disableComplianceCheck changed more than the flag");
        if (!disabledSeen) {
            disabledSeen = true;
            frozenComplianceCheck = auction.complianceCheck();
        }
    }

    /// @dev The rescuer can cancel only in rescue mode.
    function cancelByRescuer(uint256 seed) external step {
        // Gated on a hashed seed, so about one call in eight tries to cancel.
        if (uint256(keccak256(abi.encode(seed))) % 8 != 0) return;
        State memory before = _state();
        vm.prank(rescuer);
        bool ok;
        try auction.cancel() {
            ok = true;
            ++successes["cancelByRescuer"];
        } catch {}
        _check(!ok || !_final(before.phase), "cancel after an outcome or fulfillmentEnd");
        _check(!ok || before.inRescueMode, "rescuer cancelled outside rescue mode");
        if (!ok) _check(_same(before, _state()), "failed rescuer cancel changed state");
    }

    /// @dev Beyond pause and cancel, the rescuer has none of the msig's powers, in or out of rescue mode.
    function rescuerOverreach(uint256 op) external step {
        State memory before = _state();
        vm.startPrank(rescuer);
        bool ok = true;
        op = op % 4;
        if (op == 0) try auction.settleEarly() {} catch { ok = false; }
        else if (op == 1) try auction.recoverToken(address(stray), rescuer, 1) {} catch { ok = false; }
        else if (op == 2) try auction.setComplianceCheck(address(compliance2)) {} catch { ok = false; }
        else try auction.proposeNewExecutor(rescuer) {} catch { ok = false; }
        vm.stopPrank();
        _check(!ok && _same(before, _state()), "rescuer used an msig power");
    }

    /****** HANDOVERS ******/

    function proposeExecutor(uint256 seed) external step {
        address candidate = roleCandidates[seed % 5];
        State memory before = _state();
        vm.prank(msig);
        bool ok;
        try auction.proposeNewExecutor(candidate) {
            ok = true;
            ++successes["proposeExecutor"];
        } catch {}
        _checkRescueMode(ok, before);
        _check(!ok || auction.proposedExecutor() == candidate, "executor proposal not recorded");
    }

    /// @dev The proposed executor accepts. Only being the rescuer can stop it.
    function acceptExecutor() external step {
        address proposed = auction.proposedExecutor();
        if (proposed == address(0)) return;
        vm.prank(proposed);
        bool ok;
        try auction.acceptExecutor() {
            ok = true;
            ++successes["acceptExecutor"];
            msig = proposed;
        } catch {}
        _check(ok != (proposed == rescuer), "acceptExecutor: only the rescuer is refused");
        _check(auction.executor() == msig, "executor handover misrecorded");
    }

    /// @dev The rescuer can always propose its successor, in rescue mode too.
    function proposeRescuer(uint256 seed) external step {
        address candidate = roleCandidates[seed % 5];
        vm.prank(rescuer);
        bool ok;
        try auction.proposeNewRescuer(candidate) {
            ok = true;
            ++successes["proposeRescuer"];
        } catch {}
        _check(ok && auction.proposedRescuer() == candidate, "rescuer proposal refused or not recorded");
    }

    /// @dev The proposed rescuer accepts. Only being the executor can stop it.
    function acceptRescuer() external step {
        address proposed = auction.proposedRescuer();
        if (proposed == address(0)) return;
        vm.prank(proposed);
        bool ok;
        try auction.acceptRescuer() {
            ok = true;
            ++successes["acceptRescuer"];
            rescuer = proposed;
        } catch {}
        _check(ok != (proposed == msig), "acceptRescuer: only the executor is refused");
        _check(auction.rescuer() == rescuer, "rescuer handover misrecorded");
    }

    /****** COMPLIANCE ******/

    function setFlagged(uint256 seed, bool value) external step {
        // Bidders, and also the funder and the treasury caller, whose paths must stay unscreened.
        uint256 which = seed % 6;
        _flag(which < 4 ? bidders[which] : which == 4 ? config.funder : outsider, value);
    }

    /// @dev Sets `account` flagged or not on both lists, so whichever the auction points at agrees.
    function _flag(address account, bool value) internal {
        address[] memory accounts = new address[](1);
        accounts[0] = account;
        vm.startPrank(flagger);
        compliance.setFlagged(accounts, value);
        compliance2.setFlagged(accounts, value);
        vm.stopPrank();
        ++successes["setFlagged"];
    }

    /// @dev Only targeted when the fill token is a FakeBlocklistERC20: blocks or unblocks a bidder at the token.
    function setFillTokenBlocked(uint256 seed, bool value) external step {
        address account = bidders[seed % 4];
        vm.prank(flagger);
        FakeBlocklistERC20(address(fill)).setBlocked(account, value);
        fillTokenBlocked[account] = value;
        ++successes["setFillTokenBlocked"];
    }

    /****** WORLD ******/

    function strayTransfer(uint256 which, uint256 amount) external step {
        amount = _bound(amount, 1, 1e24);
        FakeERC20CustomDecimals token = which % 3 == 0 ? stray : which % 3 == 1 ? bid : fill;
        token.mint(outsider, amount);
        vm.prank(outsider);
        token.transfer(address(auction), amount);
        if (token == stray) strayOther += amount;
        else if (token == bid) strayBid += amount;
        else strayFill += amount;
        ++successes["strayTransfer"];
    }

    /// @dev Moves time forward only. Three times in four it lands on, or one second either side of, the next phase
    /// boundary, so every run passes through each phase in order. Otherwise it steps forward 1 second to 12 hours.
    /// It skips the `depositEnd` jump until the deposit phase has had MIN_DEPOSIT_PHASE_CALLS calls, and the
    /// `fulfillmentEnd` jump until a fund succeeds or the fulfillment phase has had MIN_FULFILLMENT_PHASE_CALLS, so
    /// runs build deposits and funding first.
    function warp(uint256 which, uint256 offset) external step {
        uint256 target;
        bool depositsOpen = currentTime >= config.depositStart + 1 && currentTime < config.depositEnd + 1;
        bool fundingOpen = currentTime >= config.depositEnd + 1 && currentTime < config.fulfillmentEnd + 1;
        if (
            which % 4 != 0 && !(depositsOpen && depositPhaseCalls < MIN_DEPOSIT_PHASE_CALLS)
                && !(fundingOpen && successes["fund"] == 0 && fulfillmentPhaseCalls < MIN_FULFILLMENT_PHASE_CALLS)
        ) {
            uint256 milestone = currentTime < config.depositStart + 1
                ? config.depositStart
                : currentTime < config.depositEnd + 1 ? config.depositEnd : config.fulfillmentEnd;
            target = milestone + (offset % 3) - 1;
        }
        if (target <= currentTime) target = currentTime + _bound(offset, 1, 12 hours);
        currentTime = target;
        vm.warp(target);
        ++successes["warp"];
    }

    /****** END OF RUN ******/

    /// @dev Not a fuzzed action: the suite calls it once a run ends. Lifts every brake (rescue mode, pause, both
    /// compliance lists, the fill token's blocklist), moves past `fulfillmentEnd`, then pays out every bidder still
    /// owed, every excluded balance and the treasury. Any revert fails the run, so this proves everyone can get
    /// their money out, not just that the books balance.
    function drain() external {
        vm.warp(currentTime);
        vm.recordLogs();
        if (auction.inRescueMode()) {
            vm.prank(rescuer);
            auction.setRescueMode(false);
        }
        vm.prank(msig);
        auction.setPaused(false);
        address[] memory accounts = new address[](6);
        for (uint256 i; i < 4; ++i) {
            accounts[i] = bidders[i];
        }
        accounts[4] = config.funder;
        accounts[5] = outsider;
        vm.startPrank(flagger);
        compliance.setFlagged(accounts, false);
        compliance2.setFlagged(accounts, false);
        for (uint256 i; i < 4; ++i) {
            if (fillTokenBlocked[accounts[i]]) FakeBlocklistERC20(address(fill)).setBlocked(accounts[i], false);
            fillTokenBlocked[accounts[i]] = false;
        }
        vm.stopPrank();
        if (currentTime < config.fulfillmentEnd) {
            currentTime = config.fulfillmentEnd;
            vm.warp(currentTime);
        }

        for (uint256 i; i < 4; ++i) {
            address account = bidders[i];
            if (auction.deposits(account) == 0 || auction.claimed(account)) continue;
            IFixedPriceAuction.UserClaim memory expected = auction.claimable(account);
            uint256 fillBefore = fill.balanceOf(account);
            uint256 bidBefore = bid.balanceOf(account);
            vm.prank(account);
            auction.claim();
            _bookClaim(account, expected, fillBefore, bidBefore);
        }
        for (uint256 i; i < 4; ++i) {
            address account = bidders[i];
            uint256 excluded_ = auction.excluded(account);
            if (excluded_ == 0) continue;
            vm.prank(account);
            auction.withdrawExcluded();
        }
        if (!auction.treasuryClaimed()) {
            uint256 bidBefore = bid.balanceOf(config.proceedsRecipient);
            uint256 fillBefore = fill.balanceOf(config.funder);
            vm.prank(outsider);
            auction.claimTreasury();
            _bookTreasuryClaim(bidBefore, fillBefore);
        }
        _countOutcomeEvents();
        _recordOutcome();
    }

    /****** VIEWS ******/

    function frozenSettlement() external view returns (IFixedPriceAuction.Settlement memory) {
        return _frozenSettlement;
    }

    function bidderCount() external pure returns (uint256) {
        return 4;
    }

    /****** INTERNALS ******/

    /// @dev Counts the outcome events the last call emitted, and checks an `AuctionSettled` against the settlement
    /// and `settledAt`, and an `AuctionCancelled` against the cancel settlement.
    function _countOutcomeEvents() internal {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != address(auction)) continue;
            bytes32 topic = logs[i].topics[0];
            if (topic == IFixedPriceAuction.AuctionSettled.selector) {
                ++settledEvents;
                IFixedPriceAuction.Settlement memory s = auction.settlement();
                bytes memory stored = abi.encode(
                    auction.settledAt(), auction.totalDeposits(), s.filledBids, s.userFill, s.userRefund,
                    s.funderRefund
                );
                _check(
                    keccak256(logs[i].data) == keccak256(stored), "AuctionSettled differs from the settlement"
                );
            } else if (topic == IFixedPriceAuction.AuctionCancelled.selector) {
                ++cancelledEvents;
                IFixedPriceAuction.Settlement memory s = auction.settlement();
                bytes memory stored = abi.encode(s.userRefund, s.funderRefund);
                _check(
                    keccak256(logs[i].data) == keccak256(stored) && s.userRefund == auction.totalDeposits(),
                    "AuctionCancelled differs from the settlement"
                );
            }
        }
    }

    /// @dev A reverted call's logs stay recorded; drop them so only logs from calls that took effect are counted.
    function _discardLogs() internal {
        vm.getRecordedLogs();
    }

    function _recordOutcome() internal {
        if (hasOutcome) return;
        IFixedPriceAuction.Phase current = auction.phase();
        if (current != IFixedPriceAuction.Phase.Settlement && current != IFixedPriceAuction.Phase.Cancelled) {
            IFixedPriceAuction.TreasuryClaim memory t = auction.treasuryClaimable();
            _check(t.proceeds == 0 && t.funderRefund == 0, "treasuryClaimable nonzero before settlement");
        }
        if (!_final(current)) return;
        hasOutcome = true;
        _frozenSettlement = auction.settlement();
        ghostSettledAt = auction.settledAt();
        ghostOutcome = auction.phase();
    }

    function _state() internal view returns (State memory s) {
        s.bidBalance = bid.balanceOf(address(auction));
        s.fillBalance = fill.balanceOf(address(auction));
        s.strayBalance = stray.balanceOf(address(auction));
        s.totalDeposits = auction.totalDeposits();
        for (uint256 i; i < 4; ++i) {
            s.totalExcluded += auction.excluded(bidders[i]);
        }
        s.funding = auction.funding();
        s.paused = auction.paused();
        s.inRescueMode = auction.inRescueMode();
        s.complianceDisabled = auction.complianceDisabled();
        s.complianceCheck = auction.complianceCheck();
        s.executor = auction.executor();
        s.rescuer = auction.rescuer();
        s.phase = auction.phase();
        s.settledAt = auction.settledAt();
    }

    function _same(State memory a, State memory b) internal pure returns (bool) {
        return keccak256(abi.encode(a)) == keccak256(abi.encode(b));
    }

    function _pre(
        address account
    ) internal view returns (State memory s, bool flagged, uint256 deposit_, bool claimed_) {
        s = _state();
        flagged = _flagged(account);
        deposit_ = auction.deposits(account);
        claimed_ = auction.claimed(account);
    }

    function _post(
        address account,
        bool ok,
        State memory before,
        bool flagged,
        uint256 deposit_,
        bool claimed_
    ) internal {
        _checkPaused(ok, before);
        // A flagged account can't move its deposit or claim.
        if (flagged) {
            _check(!ok, "flagged call succeeded");
            _check(
                auction.deposits(account) == deposit_ && auction.claimed(account) == claimed_, "flagged state changed"
            );
        }
    }

    function _final(IFixedPriceAuction.Phase phase_) internal pure returns (bool) {
        return phase_ == IFixedPriceAuction.Phase.Settlement || phase_ == IFixedPriceAuction.Phase.Cancelled;
    }

    /// @dev A call that succeeded ran in the phase it belongs to.
    function _checkPhase(
        bool ok,
        IFixedPriceAuction.Phase actual,
        IFixedPriceAuction.Phase expected,
        string memory why
    ) internal {
        _check(!ok || actual == expected, why);
    }

    /// @dev A token-moving call reverts while paused, and nothing changes.
    function _checkPaused(bool ok, State memory before) internal {
        if (!before.paused) return;
        _check(!ok, "token-moving call succeeded while paused");
        _check(_same(before, _state()), "state changed while paused");
    }

    /// @dev Every msig call reverts in rescue mode.
    function _checkRescueMode(bool ok, State memory before) internal {
        if (before.inRescueMode) _check(!ok, "msig call succeeded in rescue mode");
    }

    function _check(bool condition, string memory why) internal {
        if (!condition && bytes(failure).length == 0) failure = why;
    }
}
