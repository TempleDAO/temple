pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/admin/IEpochPayments.sol)

import { IPaymentBase } from "contracts/interfaces/admin/IPaymentBase.sol";

/**
 * @title Epoch Payments contract.
 * @notice Epoch increase incrementally. Epoch allocations are set once for an epoch and subsequent updates
 * for the same epoch are done using `updateEpochAllocations`. Updating can set new allocations or update existing allocations.
 */
interface IEpochPayments is IPaymentBase {
    event ClaimedEpoch(address indexed recipient, uint256 indexed epoch, uint256 amount);
    event EpochAllocationSet(address indexed recipient, uint256 indexed epoch, uint256 amount);
    event MinimumEpochDurationSet(uint256 duration);
    event NextEpochSet(uint256 epoch);

    error AllocationsLengthMismatch();
    error CannotStartEpoch(uint256 epoch);
    error ZeroClaimable();
    error AlreadyClaimed(address recipient, uint256 epoch);
    error SameAllocationAmount();
    error InvalidEpoch(uint256 epoch);

    /// @notice Total allocation, claimed and unclaimed across all epochs
    function totalAllocation() external view returns (uint256);

    /// @notice Total claimed across all epochs
    function totalClaimed() external view returns (uint256);

    /// @notice Keep track of the current active epoch
    function currentEpoch() external view returns (uint256);

    /// @notice Minimum epoch duration
    function minEpochDuration() external view returns (uint256);

    /// @notice Per-recipient per-epoch allocations
    function epochPayments(address recipient, uint256 epoch) external view returns (uint256);

    /// @notice Mapping of claimed epochs for recipient/epoch pair
    function claimedEpochs(address recipient, uint256 epoch) external view returns (bool);

    /// @notice Epoch start timestamps
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
        uint256 epoch,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external;

    /**
     * @notice Set minimum duration of an epoch
     * @param duration Minimum duration in seconds
     */
    function setMinimumEpochDuration(uint256 duration) external;

    /**
     * @notice Claim for epoch
     * @param epoch Epoch
     */
    function claimEpoch(uint256 epoch) external;
}
