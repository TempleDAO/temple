pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/templegold/IFixedPriceAuction.sol)

import { IRescuableAccess } from "contracts/interfaces/templegold/IRescuableAccess.sol";

/// @title IFixedPriceAuction
/// @notice Sells `fillToken` for deposited `bidToken` at a fixed price. Bidders deposit during the deposit
/// window and the funder funds during the fulfillment window. If funding falls short, every depositor
/// fills the same fraction and gets the rest of their bid back.
/// @dev Assumes standard ERC-20s with exact transfers: no fee-on-transfer, rebasing or callbacks.
/// A blocked or paused call reverts and the funds stay in the auction.
/// Before settlement, a blocked bidder's deposit can be moved out of the fill into a refund-only balance; see
/// exclude, reinstate and withdrawExcluded.
interface IFixedPriceAuction is IRescuableAccess {
    enum Phase {
        Scheduled,
        Deposit,
        Fulfillment,
        Settled,
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
        /// @notice Unix seconds.
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
        uint256 filledDeposits;
        /// @notice Fill tokens shared pro-rata between bidders.
        uint256 userFunding;
        /// @notice Bid tokens refunded pro-rata to bidders.
        uint256 userRefund;
        /// @notice Unused fill tokens returned to the funder.
        uint256 funderRefund;
    }

    struct UserClaim {
        /// @notice Fill tokens owed to the bidder.
        uint256 fillTokenAmount;
        /// @notice Unfilled bid tokens returned to the bidder.
        uint256 bidTokenRefund;
    }

    struct TreasuryClaim {
        /// @notice Filled bid tokens sent to the proceeds recipient.
        uint256 bidTokenAmount;
        /// @notice Unused fill tokens returned to the funder.
        uint256 fillTokenRefund;
    }

    /// @dev expected is the phase the call needs; cancel and exclude report Fulfillment, the last phase they're
    /// allowed in.
    error InvalidPhase(Phase expected, Phase actual);
    error IsPaused();
    error BlockedAccount(address account);
    /// @dev `exclude` needs the account blocked on the current list, with compliance enabled.
    error AccountNotBlocked(address account);
    error DepositBelowMinimum(uint256 deposit, uint256 minDeposit);
    error AlreadyClaimed();
    error NothingToClaim();
    error ComplianceCheckIsDisabled();
    error AlreadyInitialized();

    event Deposited(address indexed account, uint256 amount, uint256 accountDeposit, uint256 totalDeposits);
    event DepositWithdrawn(address indexed account, uint256 amount, uint256 accountDeposit, uint256 totalDeposits);
    event Funded(address indexed funder, uint256 amount, uint256 fundingHeld);
    event ExcessWithdrawn(address indexed funder, uint256 amount, uint256 fundingHeld);
    event AuctionSettled(
        uint64 endedAt,
        uint256 totalDeposits,
        uint256 filledDeposits,
        uint256 userFunding,
        uint256 userRefund,
        uint256 funderRefund
    );
    event AuctionCancelled(uint256 totalDeposits, uint256 funderRefund);
    event UserClaimed(address indexed account, uint256 fillTokenAmount, uint256 bidTokenRefund);
    event TreasuryClaimed(
        address indexed proceedsRecipient,
        address indexed funder,
        uint256 bidTokenAmount,
        uint256 fillTokenRefund
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

    /// @notice Move a blocked bidder's whole deposit out of the fill into `excluded[account]`, lowering
    /// `totalDeposits`. The msig outside rescue mode, or a caller the current compliance list grants `setBlocked`
    /// (in rescue mode too). Deposit or Fulfillment phase only; allowed while paused. Reverts unless compliance is
    /// enabled and `account` is blocked with a nonzero deposit.
    function exclude(address account) external;

    /// @notice Put an unblocked account's excluded balance back into its deposit. The msig outside rescue mode, or,
    /// while compliance is enabled, a caller the current list grants `setBlocked`. Deposit phase only; allowed
    /// while paused. Reverts if the account is still blocked or has nothing excluded.
    function reinstate(address account) external;

    /// @notice Return the caller's whole excluded balance. Any phase, once unpaused and the caller isn't blocked.
    function withdrawExcluded() external;

    /// @notice Pull `amount` fill tokens from the funder. Funder only, fulfillment phase only.
    function fund(uint256 amount) external;

    /// @notice Return `amount` fill tokens above what fills every deposit to the funder. Funder only, fulfillment
    /// phase only; at most `withdrawableExcess()`.
    function withdrawExcess(uint256 amount) external;

    /// @notice Settle now with the funding held so far. Msig only, fulfillment phase, allowed while paused. The only
    /// settlement that emits `AuctionSettled`; a settlement by the clock emits nothing, so read `previewSettlement()`.
    function endFulfillment() external;

    /// @notice Abort: no trade, and all deposits and funding become refundable. Msig only; the rescuer instead
    /// while rescue mode is on. Before settlement and fulfillmentEnd; allowed while paused.
    function cancel() external;

    /// @notice Once settled or cancelled, pay the caller their fill tokens and unfilled refund. An excluded balance
    /// comes back through withdrawExcluded.
    function claim() external;

    /// @notice Once settled or cancelled, pay filled deposits to `proceedsRecipient` and unused funding to `funder`.
    /// Anyone, once.
    function claimTreasury() external;

    /// @notice Send any token other than the bid and fill tokens. Msig only. The auction can't tell its own tokens'
    /// surplus from what's owed, so those revert; a donation of either stays in the auction for good and changes no
    /// payout.
    function recoverToken(address token, address to, uint256 amount) external;

    /// @notice Pause or unpause every token-moving function. The msig, or the rescuer instead in rescue mode.
    function setPaused(bool value) external;

    /// @notice Repoint the compliance list. Msig only; reverts on zero and after `disableComplianceCheck`.
    function setComplianceCheck(address newComplianceCheck) external;

    /// @notice Switch screening off for good. Rescuer only.
    function disableComplianceCheck() external;

    /// @notice The most decimals either token may have.
    function MAX_TOKEN_DECIMALS() external view returns (uint8);

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

    /// @notice The compliance list that screens bidders, and whose setBlocked grantees may exclude and reinstate.
    function complianceCheck() external view returns (address);

    /// @notice One-way: once true, nobody is blocked and the pointer can't change, so every excluded balance is
    /// withdrawable once unpaused and list grants can no longer exclude or reinstate.
    function complianceDisabled() external view returns (bool);

    /// @notice When endFulfillment settled the auction early (unix seconds). Zero for a settlement by the clock at
    /// fulfillmentEnd, and after a cancel.
    function endedAt() external view returns (uint40);

    /// @notice The current phase. Settled from `fulfillmentEnd` or `endFulfillment`; Cancelled after `cancel`.
    function phase() external view returns (Phase);

    /// @notice The deployment terms read from the clone's code, with the current compliance list pointer.
    function getConfig() external view returns (AuctionConfig memory);

    /// @notice Fill tokens the funder can withdraw now, in fill token base units: the funding above what fills
    /// every deposit during Fulfillment. Zero in any other phase and while paused.
    function withdrawableExcess() external view returns (uint256);

    /// @notice The settlement as of now, computed from `totalDeposits()` and `funding()`; fixed once settled or
    /// cancelled, since neither changes after that. Pro-rata shares divide by `totalDeposits()`.
    function previewSettlement() external view returns (Settlement memory);

    /// @notice What account can claim. Zero until the auction settles or is cancelled, and after claiming. Ignores the
    /// pause and the compliance list.
    function claimable(address account) external view returns (UserClaim memory);

    /// @notice What claimTreasury pays. Zero until the auction settles or is cancelled, and after claiming. Ignores the
    /// pause.
    function treasuryClaimable() external view returns (TreasuryClaim memory);
}
