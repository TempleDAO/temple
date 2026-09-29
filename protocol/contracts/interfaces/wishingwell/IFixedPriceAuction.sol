// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.20;
// (contracts/interfaces/wishingwell/IFixedPriceAuction.sol)

/// @notice Read-only compliance adapter. Reverts deliberately fail screening closed (FPA-31).
interface IComplianceCheck {
    /// @dev FPA-31.
    /// @param account Account to check.
    function isBlocked(address account) external view returns (bool);
}

/// @notice Auction construction only; later delisting does not affect existing auctions (FPA-1).
interface IAuctionTokenRegistry {
    /// @dev FPA-1, FPA-6.
    /// @param token Token address.
    function isSupported(address token) external view returns (bool);
}

/// @title IFixedPriceAuction
/// @notice One independently deployed auction, based on RFC-011 FPA-1 through FPA-48.
/// @dev FPA-37 guard exception: this implementation relies on approved tokens without callbacks.
/// @dev No minting, burning, price changes, redirected bidder claims or claim expiry.
interface IFixedPriceAuction {
    enum Phase {
        Scheduled,
        Deposit,
        Fulfillment,
        Settled,
        Cancelled
    }

    /// @notice Original deployment terms. Mutable cap/compliance state has separate getters.
    struct AuctionConfig {
        address bidToken;
        address fillToken;
        /// @notice Supplies fill tokens and receives unused funding. Immutable beneficiary.
        address funder;
        /// @notice Receives filled bid tokens. Factory enforces the TGLD burner pairing.
        address proceedsRecipient;
        /// @notice Fill tokens per whole bid token, scaled by 1e18; decimals applied on-chain.
        uint256 price;
        uint64 depositStart;
        uint64 depositDuration;
        uint64 fulfillmentDuration;
        /// @notice At least one hour and no longer than depositDuration.
        uint64 noticePeriod;
        /// @notice Minimum nonzero net balance per bidder; zero disables the minimum.
        uint256 minDeposit;
        /// @notice Initial total deposit cap; zero means unlimited.
        uint256 maxTotalDeposits;
        /// @notice Optional immutable source, which can only be disabled after deployment.
        address complianceCheck;
        /// @notice Optional immutable legal escrow for delayed frozen-fund releases.
        address frozenFundsReceiver;
        /// @notice Supported-token registry, checked once at deployment.
        address tokenRegistry;
    }

    struct AuctionTiming {
        /// @notice Configured start; emergency pauses never shift the schedule.
        uint64 depositStart;
        /// @notice Original scheduled end, before any early closure.
        uint64 scheduledDepositEnd;
        uint64 effectiveDepositEnd;
        uint64 fulfillmentStart;
        uint64 fulfillmentEnd;
    }

    /// @notice Aggregate allocation budgets; individual payouts and refunds round down.
    struct SettlementPreview {
        uint256 totalDeposits;
        uint256 filledDeposits;
        uint256 userFunding;
        uint256 userRefund;
        uint256 funderRefund;
    }

    struct UserClaim {
        uint256 fillTokenAmount;
        uint256 bidTokenRefund;
    }

    struct TreasuryClaim {
        uint256 bidTokenAmount;
        uint256 fillTokenRefund;
    }

    struct ReleaseProposal {
        address to;
        uint64 executableAt;
    }

    error InvalidConfig();
    error InvalidPhase(Phase expected, Phase actual);
    error OnlyFunder();
    error OnlyRescuer();
    error InsufficientDeposit();
    error ExcessExceeded(uint256 requested, uint256 available);
    error AlreadyClaimed();
    error NothingToClaim();
    error NoEarlierEnd();
    error DepositBelowMinimum();
    error DepositCapExceeded();
    error CannotLowerCap();
    error DepositsArePaused();
    error EmergencyPauseActive();
    error EmergencyPauseAlreadyUsed();
    error NotEmergencyPaused();
    error BlockedAccount(address account);
    error BidderIsExcluded(address account);
    error AccountNotBlocked();
    error InvalidReleaseRecipient();
    error NoReleaseProposal();
    error ReleaseNotReady();
    error InsufficientRecoverableBalance();

    // FPA-5/FPA-41: deployment, lifecycle, claims, compliance, pause and recovery event surface.
    event AuctionConfigured(AuctionConfig config, uint8 bidDecimals, uint8 fillDecimals);
    event Deposited(address indexed account, uint256 amount, uint256 accountDeposit, uint256 totalDeposits);
    event DepositWithdrawn(address indexed account, uint256 amount, uint256 accountDeposit, uint256 totalDeposits);
    event Funded(address indexed funder, uint256 amount, uint256 remainingFunding);
    event ExcessWithdrawn(address indexed funder, uint256 amount, uint256 remainingFunding);
    event DepositEndScheduled(address indexed caller, uint64 newDepositEnd, uint64 newFulfillmentEnd);
    event AuctionCancelled(address indexed caller, Phase previousPhase, uint256 userRefunds, uint256 funderRefund);
    event AuctionSettled(
        address indexed caller,
        bool early,
        uint256 totalDeposits,
        uint256 filledDeposits,
        uint256 userFunding,
        uint256 userRefund,
        uint256 funderRefund
    );
    event UserClaimed(address indexed account, uint256 fillTokenAmount, uint256 bidTokenRefund);
    event TreasuryClaimed(
        address indexed caller,
        address indexed proceedsRecipient,
        address indexed funder,
        uint256 bidTokenAmount,
        uint256 fillTokenRefund
    );
    event BidderExcluded(address indexed account, uint256 amount);
    event ClaimFrozen(address indexed account, uint256 payout, uint256 refund);
    event ReleaseProposed(address indexed account, address indexed to, uint64 executableAt);
    event ReleaseVetoed(address indexed account);
    event FrozenReleased(address indexed account, address indexed to, uint256 bidAmount, uint256 fillAmount);
    event ComplianceCheckDisabled();
    event DepositsPaused(bool paused);
    event MaxTotalDepositsSet(uint256 newCap);
    event EmergencyPaused();
    event EmergencyUnpaused();

    /// @notice Deposit caller's bid tokens
    /// @param amount Amount to deposit
    function deposit(uint256 amount) external;

    /// @notice EIP-2612 convenience deposit.
    /// @param amount Amount to deposit
    /// @param deadline Permit expiry time
    /// @param v Recovery identifier of the EIP-2612 permit signature.
    /// @param r The r component of the EIP-2612 permit signature.
    /// @param s The s component of the EIP-2612 permit signature.
    function depositWithPermit(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;

    /// @notice Withdraw during Deposit; no screening. Remainder must be zero or at least minDeposit.
    /// @param amount Amount of bid tokens to withdraw.
    function withdrawDeposit(uint256 amount) external;

    /// @notice Funder-only funding during Fulfillment. No prefunding.
    /// @dev Assumes the fill token transfers the exact requested amount.
    /// @param amount Fill tokens to supply.
    function fund(uint256 amount) external;

    /// @notice Funder-only withdrawal above the rounded-up full funding requirement during Fulfillment.
    /// @dev FPA-17, FPA-36.
    /// @param amount Excess fill tokens to withdraw.
    function withdrawExcess(uint256 amount) external;

    /// @notice Schedule earlier deposit closure with configured notice; cannot extend or run while paused.
    /// @dev FPA-13, FPA-14, FPA-36, FPA-46.
    function endDeposit() external;

    /// @notice Operator cancellation before deposits open; original-asset refunds only.
    /// @dev Allowed while emergency-paused; refunds remain blocked until explicit unpause.
    /// @dev FPA-27, FPA-28, FPA-29, FPA-36.
    function cancelScheduled() external;

    /// @notice Operator cancellation during Deposit; original-asset refunds only.
    /// @dev Allowed while emergency-paused; refunds remain blocked until explicit unpause.
    /// @dev FPA-27, FPA-28, FPA-29, FPA-36.
    function cancelDeposit() external;

    /// @notice Operator settlement during Fulfillment at current funding, including zero funding.
    /// @dev FPA-18, FPA-19, FPA-20, FPA-21, FPA-36.
    function endFulfillment() external;

    /// @notice Operator cancellation during Fulfillment, even when fully funded.
    /// @dev Allowed while paused but never after natural settlement; refunds require unpause.
    /// @dev FPA-27, FPA-28, FPA-29, FPA-36.
    function cancelFulfillment() external;

    /// @notice Permissionless persistence after expiry; idempotent for either final outcome.
    /// @dev FPA-20, FPA-21.
    function finalize() external;

    /// @notice Claim both entitlements to caller; flagged claims become frozen balances instead.
    /// @dev Lazily finalizes, marks claimed once, and never redirects to another wallet.
    /// @dev FPA-21, FPA-22, FPA-23, FPA-24, FPA-28, FPA-30, FPA-33, FPA-38a.
    function claim() external;

    /// @notice Anyone may trigger once: bid proceeds to proceedsRecipient, unused fill tokens to funder.
    /// @dev FPA-21, FPA-25, FPA-38a.
    function claimTreasury() external;

    /// @notice Operator removes a flagged bidder before settlement; freezes their entire net deposit.
    /// @dev Exclusion is irreversible for this auction; disabled compliance cannot exclude anyone.
    /// @dev FPA-15, FPA-32, FPA-35, FPA-36, FPA-38a.
    /// @param account Bidder whose deposit will be frozen.
    function excludeBidder(address account) external;

    /// @notice Operator proposes release to account or nonzero immutable escrow; restarts seven-day delay.
    /// @dev FPA-34, FPA-36.
    /// @param account Owner of the frozen funds.
    /// @param to Owner’s address or the configured frozen-funds recipient
    function proposeRelease(address account, address to) external;

    /// @notice Operator releases current frozen balances after delay; blocked by emergency pause.
    /// @dev FPA-34, FPA-35, FPA-36, FPA-38a, FPA-46.
    /// @param account Owner of the frozen funds to release.
    function executeRelease(address account) external;

    /// @notice Rescuer cancels a pending frozen-fund release, independent of rescue mode.
    /// @dev FPA-34.
    /// @param account Account whose release proposal will be cancelled.
    function vetoRelease(address account) external;

    /// @notice Operator permanently disables the configured compliance source.
    /// @dev Existing frozen balances still require delayed release.
    /// @dev FPA-31, FPA-36.
    function disableComplianceCheck() external;

    /// @notice Operator pauses deposits only; does not stop clocks or withdrawals.
    /// @dev FPA-12, FPA-36.
    /// @param paused True to pause deposits; false to allow them
    function setDepositsPaused(bool paused) external;

    /// @notice Operator raises/removes cap before final outcome. Unlimited cannot become capped again.
    /// @dev FPA-9a, FPA-36.
    /// @param newCap Maximum total bid token deposits. Zero means unlimited.
    function setMaxTotalDeposits(uint256 newCap) external;

    /// @notice Operator recovers only balances beyond all live, unclaimed and frozen liabilities.
    /// @dev Settlement dust becomes recoverable only after every participating bidder has claimed.
    /// @dev FPA-35, FPA-38, FPA-38a, FPA-40, FPA-46.
    /// @param token Token address.
    /// @param to Recipient address.
    /// @param amount Tokens to recover.
    function recoverToken(address token, address to, uint256 amount) external;

    /// @notice Rescuer-only, one-time movement pause with no automatic expiry or clock extensions.
    /// @dev FPA-43–48 revised: a timer must not reopen an unresolved exploit. Deadlines keep running.
    /// Cancellation remains available before settlement, but cannot transfer refunds while paused.
    /// Unpausing requires the rescuer; funds can remain paused indefinitely.
    function emergencyPause() external;

    /// @notice Rescuer explicitly restores transfers after investigation; the pause cannot be reused.
    /// @dev Revised FPA-44/45: does not change deadlines, final outcomes or claim entitlements.
    function emergencyUnpause() external;

    /// @dev FPA-42.
    function phase() external view returns (Phase);

    /// @dev FPA-1, FPA-2, FPA-3, FPA-5, FPA-42.
    function getConfig() external view returns (AuctionConfig memory);

    /// @dev FPA-5, FPA-42, FPA-45.
    function getTiming() external view returns (AuctionTiming memory);

    /// @dev FPA-42.
    /// @param account Bidder whose deposit is being read.
    function deposits(address account) external view returns (uint256);

    /// @dev FPA-42.
    function totalDeposits() external view returns (uint256);

    /// @notice Accounted fill-token liabilities, including frozen funds, excluding recoverable dust/donations.
    /// @dev FPA-42.
    function remainingFunding() external view returns (uint256);

    /// @dev FPA-4, FPA-30, FPA-42.
    function fullFundingRequired() external view returns (uint256);

    /// @dev FPA-42.
    function withdrawableExcess() external view returns (uint256);

    /// @dev FPA-18, FPA-19, FPA-20, FPA-22, FPA-26, FPA-30, FPA-39, FPA-42.
    function previewSettlement() external view returns (SettlementPreview memory);

    /// @notice Gross unpaid entitlement; screening occurs on claim, so this may be frozen rather than paid.
    /// @dev FPA-42.
    /// @param account Bidder whose unpaid claim to read.
    function claimable(address account) external view returns (UserClaim memory);

    /// @dev FPA-42.
    function treasuryClaimable() external view returns (TreasuryClaim memory);

    /// @dev FPA-42.
    /// @param account Account whose frozen bid token balance to read.
    function frozenBid(address account) external view returns (uint256);

    /// @dev FPA-42.
    /// @param account Account whose frozen fill token balance to reed.
    function frozenFill(address account) external view returns (uint256);

    /// @dev FPA-42.
    function complianceCheck() external view returns (address);

    /// @dev FPA-42.
    function maxTotalDeposits() external view returns (uint256);

    /// @dev FPA-42.
    function depositsPaused() external view returns (bool);

    /// @dev FPA-42.
    function emergencyPaused() external view returns (bool);

    /// @dev FPA-42.
    function emergencyPauseUsed() external view returns (bool);

    /// @notice Total reserved amounts, including unclaimed budgets and frozen balances.
    /// @dev FPA-38, FPA-38a, FPA-40.
    function liabilities() external view returns (uint256 bid, uint256 fill);

    /// @dev FPA-42.
    /// @param account Account whose release proposal is beeing read.
    function releaseProposal(address account) external view returns (ReleaseProposal memory);

    /// @notice Whether the proceeds recipient and funder claim has been processed.
    function treasuryClaimed() external view returns (bool);

    /// @notice Whether the account's claim has been processed, including frozen claims.
    /// @param account Account to check.
    function claimed(address account) external view returns (bool);

    /// @notice Check if account is excluded
    /// @param account Address to check for exclusion
    function excluded(address account) external view returns (bool);

    /// @notice Number of decimals used by the bid token.
    function bidDecimals() external view returns (uint8);

    /// @notice Number of decimals used by the fill token.
    function fillDecimals() external view returns (uint8);

    /// @notice Minimum notice before deposits can close early, in seconds.
    function MIN_NOTICE() external view returns (uint64);

    /// @notice Maximum deposit or fulfillment duration, in seconds.
    function MAX_DURATION() external view returns (uint64);

    /// @notice Delay before frozen funds can be released, in seconds.
    function FROZEN_ACTION_DELAY() external view returns (uint64);

    /// @notice Number of non-excluded bidders whose claims remain unprocessed.
    function unclaimedBidders() external view returns (uint256);
}
