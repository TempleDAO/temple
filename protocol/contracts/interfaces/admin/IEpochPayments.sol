pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/admin/IEpochPayments.sol)

import { IPaymentBase } from "contracts/interfaces/admin/IPaymentBase.sol";

interface IEpochPayments is IPaymentBase {
    // event CancelledPayment(address indexed recipient, uint256 totalClaimed, uint256 unreleased);
    event CancelledEpochPayment(address indexed recipient, uint256 epoch, uint256 amountRevoked);
    // event PaymentSet(address indexed recipient, uint40 startTime, uint40 endTime, uint256 amount);
    event ClaimedEpoch(address indexed recipient, uint256 epoch, uint256 amount);
    // event ClaimedFixed(address indexed recipient, uint256 amount, uint256 claimed);
    event EpochAllocationSet(address indexed recipient, uint256 epoch, uint256 amount);
    event MinimumEpochDurationSet(uint256 duration);
    event NextEpochSet(uint256 epoch);

    error AllocationsLengthMismatch();
    error EpochAlreadySet();
    error CannotStartEpoch(uint256 epoch);
    // error PaymentCancelled();
    error NothingClaimable();
    error AlreadyClaimed();
    // error NoPayment();

    // /**
    //  * @notice Set fixed payments
    //  * @param _recipients Recipients array
    //  * @param _payments Amounts array to set
    //  */
    // function setPayments(
    //     address[] calldata _recipients,
    //     Payment[] calldata _payments
    // ) external;

    /**
     * @notice Set epoch payments
     * @param recipients Recipients array
     * @param amounts Amounts array to set
     */
    function setEpochPayments(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external;

    // /**
    //  * @notice Revoke payment for contributor
    //  * @dev Accumulated amount at block.timestamp is transferred to contributor
    //  * @param _recipient Recipient
    //  */
    // function revokePayment(address _recipient) external;

    /**
     * @notice Revoke epoch payment for contributor
     * @param epoch Epoch to revoke
     * @param recipient Recipient
     */
    function revokeEpochPayment(uint256 epoch, address recipient) external;

    // /**
    //  * @notice Claim payment (type fixed payment)
    //  */
    // function claim() external;

    /**
     * @notice Claim for epoch
     * @param epoch Epoch
     */
    function claimEpoch(uint256 epoch) external;

    // /**
    //  * @notice Get claimable payment
    //  * @param recipient Recipient
    //  * @return Claimable payment
    //  */
    // function getClaimablePayment(address recipient) external view returns (uint256);

    // /**
    //  * @notice Get claimable payment at a provieed time
    //  * @param recipient Recipient
    //  * @param at Provided time
    //  * @return Claimable payment
    //  */
    // function getClaimablePaymentAt(address recipient, uint256 at) external view returns (uint256);

    // /**
    //  * @notice Get payment info
    //  * @param recipient Recipient
    //  * @return Payment info
    //  */
    // function getPaymentInfo(address recipient) external view returns (Payment memory);
}