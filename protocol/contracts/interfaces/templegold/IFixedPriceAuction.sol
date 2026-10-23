pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/templegold/IFixedPriceAuction.sol)

import { IRescuableAccess } from "contracts/interfaces/templegold/IRescuableAccess.sol";

/// @title IFixedPriceAuction
/// @notice Sells `fillToken` for deposited `bidToken` at a fixed price. Bidders deposit during the deposit
/// window and the funder funds during the fulfillment window. If funding falls short, every depositor
/// fills the same fraction and gets the rest of their bid back.
/// @dev Assumes standard ERC-20s with exact transfers: no fee-on-transfer, rebasing or callbacks.
/// A flagged or paused call reverts and the funds stay in the auction.
/// Before settlement, a flagged bidder's deposit can be moved out of the fill into a refund-only balance; see
/// exclude, reinstate and withdrawExcluded.
interface IFixedPriceAuction is IRescuableAccess {
    enum Phase {
        Scheduled,
        Deposit,
        Fulfillment,
        Settlement,
        Cancelled
    }

    /// @notice Deployment terms, abi-encoded into the clone's code by the factory.
    struct AuctionConfig {
        address bidToken;
        address fillToken;
        /// @notice Fill tokens per whole bid token, scaled by 1e18; decimals are applied on-chain.
        uint256 price;
        /// @notice Unix seconds.
        uint64 depositStart;
        /// @notice Unix seconds.
        uint64 depositEnd;
        /// @notice Unix seconds, at most `type(uint40).max`.
        uint64 fulfillmentEnd;
        /// @notice Minimum nonzero deposit balance per bidder, in bid token base units; zero disables it.
        uint256 minDeposit;
        /// @notice Supplies fill tokens and receives unused funding.
        address funder;
        /// @notice Receives filled bid tokens.
        address proceedsRecipient;
        /// @notice Initial compliance list. `getConfig` returns the current pointer.
        address complianceCheck;
    }

    /// @notice All amounts in token base units. Fixed once Fulfillment ends or the auction is cancelled.
    struct Settlement {
        /// @notice Bid tokens filled, paid to the proceeds recipient.
        uint256 filledBids;
        /// @notice Fill tokens shared pro-rata between bidders.
        uint256 userFill;
        /// @notice Bid tokens refunded pro-rata to bidders.
        uint256 userRefund;
        /// @notice Unused fill tokens returned to the funder.
        uint256 funderRefund;
    }

    struct UserClaim {
        /// @notice Fill tokens owed to the bidder.
        uint256 fill;
        /// @notice Unfilled bid tokens returned to the bidder.
        uint256 refund;
    }

    struct TreasuryClaim {
        /// @notice Filled bid tokens sent to the proceeds recipient.
        uint256 proceeds;
        /// @notice Unused fill tokens returned to the funder.
        uint256 funderRefund;
    }

    /// @dev expected is the phase the call needs; cancel and exclude report Fulfillment, the last phase they're
    /// allowed in.
    error InvalidPhase(Phase expected, Phase actual);
    error IsPaused();
    error FlaggedAccount(address account);
    /// @dev `exclude` needs the account flagged on the current list, with compliance enabled.
    error AccountNotFlagged(address account);
    error DepositBelowMinimum(uint256 deposit, uint256 minDeposit);
    error AlreadyClaimed();
    error NothingToClaim();
    error ComplianceCheckIsDisabled();
    error AlreadyInitialized();
    /// @dev `AuctionSettled` was already emitted, by `settleEarly`, a claim or `emitSettlement`.
    error AlreadySettled();

    event Deposited(address indexed account, uint256 amount, uint256 accountDeposit, uint256 totalDeposits);
    event DepositWithdrawn(address indexed account, uint256 amount, uint256 accountDeposit, uint256 totalDeposits);
    event Funded(address indexed funder, uint256 amount, uint256 fundingHeld);
    event ExcessWithdrawn(address indexed funder, uint256 amount, uint256 fundingHeld);
    /// @notice Once per settlement: from `settleEarly`, or for a settlement by the clock from the first successful
    /// `claim` or `claimTreasury`, or `emitSettlement` if that comes first, with `settledAt` = `fulfillmentEnd`.
    event AuctionSettled(
        uint64 settledAt,
        uint256 totalDeposits,
        uint256 filledBids,
        uint256 userFill,
        uint256 userRefund,
        uint256 funderRefund
    );
    event AuctionCancelled(uint256 totalDeposits, uint256 funderRefund);
    event UserClaimed(address indexed account, uint256 fill, uint256 refund);
    event TreasuryClaimed(
        address indexed proceedsRecipient,
        address indexed funder,
        uint256 proceeds,
        uint256 funderRefund
    );
    event BidderExcluded(address indexed account, uint256 amount);
    event BidderReinstated(address indexed account, uint256 amount);
    event ExcludedWithdrawn(address indexed account, uint256 amount);
    event PausedSet(bool paused);
    event ComplianceCheckSet(address indexed complianceCheck);
    event ComplianceCheckDisabled();

    /// @notice Validate the config in the clone's code and set the roles. Once per clone; the implementation
    /// itself can never be initialized. The factory calls this in the same transaction as the clone.
    function initialize(address initialExecutor, address initialRescuer) external;

    /// @notice Pull `amount` bid tokens from the caller into their deposit. Deposit phase only; the new balance must be
    /// at least `minDeposit`.
    function deposit(uint256 amount) external;

    /// @notice Return `amount` of the caller's deposit to them. Deposit phase only; the remainder must be zero or at
    /// least `minDeposit`.
    function withdrawDeposit(uint256 amount) external;

    /// @notice Move a flagged bidder's whole deposit out of the fill into `excluded[account]`, lowering
    /// `totalDeposits`. The msig, or a flagger on the current compliance list, both outside rescue mode. Deposit or
    /// Fulfillment phase only; allowed while paused. Reverts unless compliance is enabled and `account` is flagged
    /// with a nonzero deposit.
    function exclude(address account) external;

    /// @notice Put an unflagged account's excluded balance back into its deposit. The msig or, while compliance is
    /// enabled, a flagger on the current list, both outside rescue mode. Deposit phase only; allowed while paused.
    /// Reverts if the account is still flagged or has nothing excluded.
    function reinstate(address account) external;

    /// @notice Return the caller's whole excluded balance. Any phase, once unpaused and the caller isn't flagged.
    function withdrawExcluded() external;

    /// @notice Pull `amount` fill tokens from the funder. Funder only, fulfillment phase only.
    function fund(uint256 amount) external;

    /// @notice Return `amount` fill tokens above what fills every deposit to the funder. Funder only, fulfillment
    /// phase only; at most `withdrawableExcess()`.
    function withdrawExcess(uint256 amount) external;

    /// @notice End Fulfillment early: Settlement begins with the funding held so far, emitting `AuctionSettled`.
    /// Msig only, Fulfillment phase, allowed while paused.
    function settleEarly() external;

    /// @notice Emit `AuctionSettled` for an auction the clock settled at `fulfillmentEnd`, if no claim has emitted it
    /// yet, and record `fulfillmentEnd` in `settledAt`. Anyone, once; Settlement phase only. Moves no tokens and changes
    /// no payout. Reverts `AlreadySettled` once the event has gone out.
    function emitSettlement() external;

    /// @notice Abort: no trade, and all deposits and funding become refundable. Msig only; the rescuer instead
    /// while rescue mode is on. Before settlement and fulfillmentEnd; allowed while paused.
    function cancel() external;

    /// @notice Once settled or cancelled, pay the caller their fill tokens and unfilled refund. A flagged caller's
    /// claim is frozen until the flag is removed. An excluded balance comes back through withdrawExcluded. The first
    /// successful `claim` or `claimTreasury` after a settlement by the clock emits `AuctionSettled` and sets
    /// `settledAt`.
    function claim() external;

    /// @notice Once settled or cancelled, pay filled deposits to `proceedsRecipient` and unused funding to `funder`.
    /// Anyone, once. The first successful `claim` or `claimTreasury` after a settlement by the clock emits
    /// `AuctionSettled` and sets `settledAt`.
    function claimTreasury() external;

    /// @notice Send `amount` of the auction's surplus of `token`: its balance less `liabilities()` for the bid and
    /// fill tokens, the whole balance for any other token. Msig only, outside rescue mode, while unpaused. Reverts
    /// `InsufficientBalance` above that.
    function recoverToken(address token, address to, uint256 amount) external;

    /// @notice Pause or unpause every token-moving function. The msig, or the rescuer instead in rescue mode.
    function setPaused(bool value) external;

    /// @notice Repoint the compliance list. Msig only; reverts on zero, on an address that doesn't answer `isFlagged`
    /// (no code, or the wrong contract) and after `disableComplianceCheck`.
    function setComplianceCheck(address newComplianceCheck) external;

    /// @notice Switch screening off for good. Rescuer only.
    function disableComplianceCheck() external;

    /// @notice 10**(18 + bidDecimals - fillDecimals): a bid amount (bid token base units) times `price`, divided by
    /// this, gives fill token base units.
    function priceDenominator() external view returns (uint256);

    /// @notice The deposit of `account`, in bid token base units. `exclude` zeroes it; claiming doesn't.
    function deposits(address account) external view returns (uint256);

    /// @notice True once `account` has claimed.
    function claimed(address account) external view returns (bool);

    /// @notice True once `claimTreasury` has paid out.
    function treasuryClaimed() external view returns (bool);

    /// @notice The sum of all deposits, in bid token base units. Excluded balances aren't in it.
    function totalDeposits() external view returns (uint256);

    /// @notice Bid tokens of `account` taken out of the fill by `exclude`, in bid token base units. Never filled;
    /// held until `withdrawExcluded`, or `reinstate` during Deposit.
    function excluded(address account) external view returns (uint256);

    /// @notice Fill tokens the funder has put in, net of `withdrawExcess`, in fill token base units. Fixed once
    /// Fulfillment ends; claims don't change it.
    function funding() external view returns (uint256);

    /// @notice True while every token-moving function is stopped.
    function paused() external view returns (bool);

    /// @notice The compliance list that screens bidders, and whose flaggers may exclude and reinstate.
    function complianceCheck() external view returns (address);

    /// @notice One-way: once true, nobody is flagged and the pointer can't change, so every excluded balance is
    /// withdrawable once unpaused and flaggers can no longer exclude or reinstate.
    function complianceDisabled() external view returns (bool);

    /// @notice When the auction settled (unix seconds): set by `settleEarly`, or to `fulfillmentEnd` by the first
    /// claim or `emitSettlement` after a settlement by the clock. Zero until then, and after a cancel.
    function settledAt() external view returns (uint40);

    /// @notice The sum of every `excluded` balance, in bid token base units.
    function totalExcluded() external view returns (uint256);

    /// @notice Bid tokens paid out by `claim` and `claimTreasury`, in bid token base units.
    function bidPaid() external view returns (uint256);

    /// @notice Fill tokens paid out by `claim` and `claimTreasury`, in fill token base units.
    function fillPaid() external view returns (uint256);

    /// @notice What the auction still owes, in each token's base units, to bidders (including excluded balances),
    /// the proceeds recipient and the funder: `totalDeposits() + totalExcluded() - bidPaid()` and
    /// `funding() - fillPaid()`. Only a balance above this is recoverable. Rounding dust stays counted for good.
    function liabilities() external view returns (uint256 bidLiability, uint256 fillLiability);

    /// @notice The current phase. Settlement from `fulfillmentEnd` or `settleEarly`; Cancelled after `cancel`.
    function phase() external view returns (Phase);

    /// @notice The deployment terms read from the clone's code, with the current compliance list pointer.
    function getConfig() external view returns (AuctionConfig memory);

    /// @notice Fill tokens the funder can withdraw now, in fill token base units: the funding above what fills
    /// every deposit during Fulfillment. Zero in any other phase and while paused.
    function withdrawableExcess() external view returns (uint256);

    /// @notice The settlement as of now, computed from `totalDeposits()` and `funding()`; fixed once settled or
    /// cancelled, since neither changes after that. Pro-rata shares divide by `totalDeposits()`.
    function settlement() external view returns (Settlement memory);

    /// @notice What account can claim. Zero until the auction settles or is cancelled, and after claiming. Ignores the
    /// pause and the compliance list.
    function claimable(address account) external view returns (UserClaim memory);

    /// @notice What claimTreasury pays. Zero until the auction settles or is cancelled, and after claiming. Ignores the
    /// pause.
    function treasuryClaimable() external view returns (TreasuryClaim memory);
}
