pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/admin/IEpochPayments.sol)

import { IPaymentBase } from "contracts/interfaces/admin/IPaymentBase.sol";

interface IEpochPayments is IPaymentBase {
    event CancelledEpochPayment(address indexed recipient, uint256 epoch, uint256 amountRevoked);
    event ClaimedEpoch(address indexed recipient, uint256 epoch, uint256 amount);
    event EpochAllocationSet(address indexed recipient, uint256 epoch, uint256 amount);
    event MinimumEpochDurationSet(uint256 duration);
    event NextEpochSet(uint256 epoch);

    error AllocationsLengthMismatch();
    error EpochAlreadySet();
    error CannotStartEpoch(uint256 epoch);
    error ZeroClaimable();
    error AlreadyClaimed(address recipient, uint256 epoch);
    error EpochEnded();
    error InvalidEpoch(uint256 epoch);

    /// @notice Total allocation, claimed and unclaimed
    function totalAllocation() external view returns (uint256);

    /// @notice Total Claimed
    function totalClaimed() external view returns (uint256);

    /// @notice Keep track of the current active epoch
    function currentEpoch() external view returns (uint256);

    /// @notice Minimum epoch duration
    function minEpochDuration() external view returns (uint256);

    /// @notice Epoch payments. variable payments
    function epochPayments(address recipient, uint256 epoch) external view returns (uint256);

    /// @notice Mapping of claimed epochs for recipient/epoch pair
    function claimedEpochs(address recipient, uint256 epoch) external view returns (bool);

    /// @notice Epochs to start time mapping
    function epochStartTimes(uint256 epoch) external view returns (uint256);

    /**
     * @notice Set initial epoch payments for the next epoch
     * @param recipients Recipients array
     * @param amounts Amounts array to set
     */
    function setEpochPayments(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external;

    /**
     * @notice Update existing or set new payments for the current epoch
     * @param recipients Recipients array
     * @param amounts Amounts array to set
     */
    function updateEpochPayments(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external;

    /**
     * @notice Revoke epoch payment for contributor
     * @param epoch Epoch to revoke
     * @param recipient Recipient
     */
    function revokeEpochPayment(uint256 epoch, address recipient) external;

    /**
     * @notice Claim for epoch
     * @param epoch Epoch
     */
    function claimEpoch(uint256 epoch) external;
}