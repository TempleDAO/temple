// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.20;
// (contracts/interfaces/wishingwell/IFixedPriceAuction.sol)


/// @title IFixedPriceAuction
/// @notice One fixed-price Treasury auction, with optional funding and proportional allocation.
/// @dev Users deposit one asset; Treasury supplies another only after deposits close. A wish is
/// not required. No price changes, native ETH, fees, balance rebasing or transfer taxes are supported.
/// Cancellation returns original assets; settlement executes the current funded portion.
interface IFixedPriceAuction {
    /// @notice Time-derived live phase or irreversible terminal outcome.
    /// @dev Settled is reported at the fulfillment deadline even before the snapshot is persisted.
    enum Phase {
        Scheduled,
        Deposit,
        Fulfillment,
        Settled,
        Cancelled
    }

    /// @notice Immutable auction terms, expressed in token base units and Unix seconds.
    struct AuctionConfig {
        /// @notice Contract address of the token participants deposit.
        address depositToken;
        /// @notice Contract address of the different token Treasury provides.
        address fundingToken;
        /// @notice Sole funder and fixed beneficiary of all Treasury withdrawals and claims.
        address treasury;
        /// @notice Numerator of funding-token base units per deposit-token base unit.
        uint256 priceNumerator;
        /// @notice Nonzero denominator; callers must incorporate both assets' decimals.
        uint256 priceDenominator;
        /// @notice Earliest accepted user deposit timestamp; cannot precede deployment.
        uint64 depositStart;
        /// @notice Positive deposit window length in seconds.
        uint64 depositDuration;
        /// @notice Positive funding window length measured from the actual deposit end.
        uint64 fulfillmentDuration;
    }

    /// @notice Configured and effective time boundaries. Cancellation does not rewrite them.
    struct AuctionTiming {
        uint64 depositStart;
        uint64 scheduledDepositEnd;
        /// @notice Scheduled end, or the timestamp of endDeposit if it was called early.
        uint64 effectiveDepositEnd;
        /// @notice Equal to effectiveDepositEnd; there is no gap between epochs.
        uint64 fulfillmentStart;
        /// @notice Effective start plus the full configured fulfillment duration.
        uint64 fulfillmentEnd;
    }

    /// @notice Aggregate budgets, not the sum of rounded individual claims.
    struct SettlementPreview {
        uint256 totalDeposits;
        /// @notice Deposit tokens allocated to Treasury; zero on cancellation.
        uint256 filledDeposits;
        /// @notice Funding-token budget shared proportionally among users.
        uint256 userFunding;
        /// @notice Deposit-token refund budget shared proportionally among users.
        uint256 userDepositRefund;
        /// @notice Unused funding returned to Treasury, excluding any prior excess withdrawals.
        uint256 treasuryFundingRefund;
    }

    /// @notice A participant's withdrawable amounts. Zero before terminalization or after claiming.
    struct UserClaim {
        uint256 fundingTokenAmount;
        uint256 depositTokenRefund;
    }

    /// @notice Treasury's withdrawable amounts, always payable to the configured beneficiary.
    struct TreasuryClaim {
        uint256 depositTokenAmount;
        uint256 fundingTokenRefund;
    }

    error InvalidConfig();
    error InvalidPhase(Phase expected, Phase actual);
    error OnlyTreasury();
    error InsufficientDeposit();
    error ExcessExceeded(uint256 requested, uint256 available);
    error AlreadyClaimed();
    error NothingToClaim();
    /// @notice Sender or recipient balance change does not equal the requested transfer amount.
    error UnsupportedTokenTransfer(address token);

    /// @notice Emitted after recording an exact deposit-token transfer into escrow.
    event Deposited(address indexed account, uint256 amount, uint256 accountDeposit, uint256 totalDeposits);
    /// @notice Emitted after reducing the user's deposit during the deposit epoch.
    event DepositWithdrawn(address indexed account, uint256 amount, uint256 accountDeposit, uint256 totalDeposits);
    /// @notice Emitted for a Treasury installment, with funding currently held in recorded reserves.
    event Funded(address indexed treasury, uint256 amount, uint256 remainingFunding);
    /// @notice Emitted for an excess-only funding withdrawal during fulfillment.
    event ExcessWithdrawn(address indexed treasury, uint256 amount, uint256 remainingFunding);
    /// @notice Emitted when deposit closure brings the full fulfillment window forward.
    event DepositEndedEarly(address indexed caller, uint64 depositEnd, uint64 fulfillmentEnd);
    /// @notice Cancellation freezes refunds without executing any trade.
    event AuctionCancelled(address indexed caller, Phase previousPhase, uint256 userRefunds, uint256 treasuryRefund);
    /// @notice Settlement freezes aggregate budgets. early is false for natural expiry.
    event AuctionSettled(
        address indexed caller,
        bool early,
        uint256 totalDeposits,
        uint256 filledDeposits,
        uint256 userFunding,
        uint256 userDepositRefund,
        uint256 treasuryFundingRefund
    );
    /// @notice Emitted when user claims
    event UserClaimed(address indexed account, uint256 fundingTokenAmount, uint256 depositTokenRefund);
    /// @notice Emitted when treasury claims
    event TreasuryClaimed(
        address indexed caller, address indexed treasury, uint256 depositTokenAmount, uint256 fundingTokenRefund
    );

    /// @notice Track accounts that have claimed proceeds
    function claimed(address account) external view returns (bool);

    /// @notice Check if Treasury has claimed 
    function treasuryClaimed() external view returns (bool);

    /// @notice Deposit tokens during the deposit epoch; repeated deposits accumulate.
    /// @dev Requires ERC-20 allowance. Amount must be nonzero. Exact sender/receiver balance deltas
    /// are enforced. Reverts if the resulting full-funding requirement cannot fit uint256.
    /// @param amount Deposit-token base units to transfer from the caller into escrow.
    function deposit(uint256 amount) external;

    /// @notice Withdraw some or all of the caller's net deposit before the deposit epoch ends.
    /// @dev No withdrawals at or after effectiveDepositEnd. Reduces the allocation denominator.
    /// @param amount Nonzero deposit-token base units, no greater than the caller's net deposit.
    function withdrawDeposit(uint256 amount) external;

    /// @notice Supply funding during fulfillment, in one or multiple installments.
    /// @dev Only the configured Treasury. Prefunding, post-deadline and terminal-state funding revert.
    /// No quantity guarantee is created; the entire auction can still be cancelled before settlement.
    /// @param amount Nonzero funding-token base units to pull from Treasury.
    function fund(uint256 amount) external;

    /// @notice Withdraw funding exceeding the conservative 100% funding requirement.
    /// @dev Only Treasury, during fulfillment. A request exceeding the available excess reverts
    /// entirely. Recovering committed funding requires cancelling the entire auction instead.
    /// @param amount Nonzero funding-token base units to send to the fixed Treasury beneficiary.
    function withdrawExcess(uint256 amount) external;

    /// @notice Close deposits now and immediately start the full configured fulfillment duration.
    /// @dev Elevated access only, during Deposit. Does not settle or refund the auction.
    function endDeposit() external;

    /// @notice Cancel before deposits open. Elevated access only, during Scheduled.
    function cancelScheduled() external;

    /// @notice Cancel during Deposit and unlock full original-asset user refunds.
    /// @dev Elevated access only. Treasury could not have funded this auction yet.
    function cancelDeposit() external;

    /// @notice Settle the current full, partial or zero fill immediately.
    /// @dev Elevated access only, during Fulfillment. Different from cancellation: trades execute.
    function endFulfillment() external;

    /// @notice Abort during Fulfillment, even if fully funded; neither side exchanges assets.
    /// @dev Elevated access only. Full original-asset refunds exclude prior deposit/excess withdrawals.
    /// Cannot cancel at/after the deadline, even if nobody has persisted the settlement snapshot.
    function cancelFulfillment() external;

    /// @notice Persist settlement at/after natural expiry. Callable by anyone.
    /// @dev Idempotent once settled; reverts while live or cancelled. Does not transfer tokens.
    function finalize() external;

    /// @notice Claim the caller's output and unfilled deposit, or full original deposit if cancelled.
    /// @dev Permissionless finalization is automatic after natural expiry. One combined claim per
    /// participant; transfers always go to that participant. Claims with a nonzero recorded deposit
    /// may round to zero and still complete. Nonparticipants and repeated claims revert.
    /// Individual settlement payouts/refunds round down; cancellation refunds are exact.
    function claim() external;

    /// @notice Claim purchased deposits and unused funding, or remaining original funding on cancellation.
    /// @dev Anyone may trigger once, but proceeds always go to Treasury. Finalizes if naturally due.
    function claimTreasury() external;

    /// @notice Return the effective phase based on timestamps and terminal state.
    function phase() external view returns (Phase);

    /// @notice Return the unchangeable token, price, beneficiary and original schedule configuration.
    function getConfig() external view returns (AuctionConfig memory);

    /// @notice Return scheduled and effective timestamps, including the effect of endDeposit.
    function getTiming() external view returns (AuctionTiming memory);

    /// @notice Net deposited amount, reduced by deposit-period withdrawals but retained after claims.
    function deposits(address account) external view returns (uint256);

    /// @notice Total net deposits, frozen when deposits close and retained after claims.
    function totalDeposits() external view returns (uint256);

    /// @notice Accounted funding still held, reduced by excess withdrawals and funding-token claims.
    /// @dev Excludes unsolicited transfers. After settlement, use the snapshot for original fill figures.
    function remainingFunding() external view returns (uint256);

    /// @notice Conservative full funding requirement: ceil(totalDeposits * numerator / denominator).
    function fullFundingRequired() external view returns (uint256);

    /// @notice Excess withdrawable now; zero outside fulfillment or when not overfunded.
    function withdrawableExcess() external view returns (uint256);

    /// @notice Provisional settlement budgets while live; immutable budgets after settlement/cancellation.
    /// @dev A preview is not an execution guarantee. Filled deposit units round down, as does their
    /// aggregate price conversion. If no whole funding unit can be paid, no trade is executed.
    /// Each user receives floor(their deposit * budget / totalDeposits) for each output/refund budget.
    /// Residual rounding dust is retained, without a sweep function; claim order cannot change payouts.
    function previewSettlement() external view returns (SettlementPreview memory);

    /// @notice Return currently withdrawable user amounts, zero before completion or after claiming.
    function claimable(address account) external view returns (UserClaim memory);

    /// @notice Return currently withdrawable Treasury amounts, zero before completion or after claiming.
    function treasuryClaimable() external view returns (TreasuryClaim memory);
}