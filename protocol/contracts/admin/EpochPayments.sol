pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (admin/EpochPayments.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IEpochPayments } from "contracts/interfaces/admin/IEpochPayments.sol";
import { IPaymentBase } from "contracts/interfaces/admin/IPaymentBase.sol";

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { TempleMath } from "contracts/common/TempleMath.sol";
import { PaymentBase } from "contracts/admin/PaymentBase.sol";

/**
 * @title Team Payments
 * @notice New team payments contract
 */
contract EpochPayments is IEpochPayments, PaymentBase, TempleElevatedAccess {
    using SafeERC20 for IERC20;

    /// @notice Total allocation, claimed and unclaimed
    uint256 public totalAllocation;

    /// @notice Total Claimed
    uint256 public totalClaimed;

    /// @notice Keep track of the current active epoch
    uint256 public currentEpoch;

    /// @notice Minimum epoch duration
    uint256 public minEpochDuration;

    /// @notice Epoch payments. variable payments
    mapping(address recipient => mapping(uint256 epoch => uint256 amount)) public epochPayments;

    /// @notice Claimed epochs
    mapping(address recipient => mapping(uint256 epoch => bool claimed)) public claimedEpochs;

    /// @notice Epochs
    mapping(uint256 epoch => uint256 startTime) public epochStartTimes;

    constructor(
        address _rescuer,
        address _executor,
        address _fundsOwner,
        address _paymentToken
    ) TempleElevatedAccess(_rescuer, _executor) PaymentBase(_paymentToken) {
        fundsOwner = _fundsOwner;
    }

    /// @inheritdoc IPaymentBase
    function setFundsOwner(address _fundsOwner) external override onlyElevatedAccess {
        _setFundsOwner(_fundsOwner);
    }

    /// @inheritdoc IEpochPayments
    function setEpochPayments(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external override onlyElevatedAccess {
        // attempt to start next epoch
        uint256 epoch = _startNextEpoch();
        uint256 _length = recipients.length;
        if (_length != amounts.length) { revert AllocationsLengthMismatch(); }
        for (uint256 i; i < _length; ++i) {
            _setEpochAllocation(epoch, recipients[i], amounts[i]);
        }
    }

    /// @inheritdoc IEpochPayments
    function updateEpochPayments(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external override onlyElevatedAccess {
        // use current epoch
        uint256 currentEpochCache = currentEpoch;
        // check min time between epochs has not passed
        if (epochStartTimes[currentEpochCache] + minEpochDuration < block.timestamp) { revert EpochEnded(); }
        uint256 _length = recipients.length;
        if (_length != amounts.length) { revert AllocationsLengthMismatch(); }
        address recipient;
        for (uint256 i; i < _length; ++i) {
            // check if recipient has already claimed before update
            recipient = recipients[i];
            if (claimedEpochs[recipient][currentEpochCache]) { revert AlreadyClaimed(recipient, currentEpochCache); }
            _setEpochAllocation(currentEpochCache, recipient, amounts[i]);
        }
    }

    /// @notice Set minimum duration of an epoch. Used to check against before incrementing epoch
    /// @dev Made mutable so that admin can use as a way to enforce starting a new epoch at an earlier time.
    /// Eg. setting value to 28 from 30
    function setMinimumEpochDuration(uint256 duration) external onlyElevatedAccess {
        if (duration == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        minEpochDuration = duration;
        emit MinimumEpochDurationSet(duration);
    }

    /**
     * @notice Revoke epoch payment for contributor
     * @param epoch Epoch to revoke
     * @param recipient Recipient
     */
    function revokeEpochPayment(uint256 epoch, address recipient) external override onlyElevatedAccess {
        if (recipient == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        if (epoch == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        // validate
        if (claimedEpochs[recipient][epoch]) { revert AlreadyClaimed(recipient, epoch); }
        uint256 _amount = epochPayments[recipient][epoch];
        if (_amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        epochPayments[recipient][epoch] = 0;
        totalAllocation -= _amount;
        emit CancelledEpochPayment(recipient, epoch, _amount);
    }

    /**
     * @notice Claim for epoch
     * @param epoch Epoch
     */
    function claimEpoch(uint256 epoch) external override {
        if (epoch == 0) { revert CommonEventsAndErrors.InvalidParam(); }
        if (claimedEpochs[msg.sender][epoch]) { revert AlreadyClaimed(msg.sender, epoch); }
        uint256 _amount = epochPayments[msg.sender][epoch];
        if (_amount == 0) { revert NothingClaimable(); }

        claimedEpochs[msg.sender][epoch] = true;
        _updateAndTransfer(_amount);
        emit ClaimedEpoch(msg.sender, epoch, _amount);
    }

    /// @inheritdoc IPaymentBase
    function recoverToken(address _token, address _to, uint256 _amount) external override onlyElevatedAccess {
        _recoverToken(_token, _to, _amount);
    }

    function _setEpochAllocation(uint256 _epoch, address _recipient, uint256 _amount) private {
        if (_amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        if (_recipient == address(0)) { revert CommonEventsAndErrors.InvalidAddress();}
        /// @dev not checking if recipient has already claimed because at this point, `currentEpoch` has incremented. So we are dealing with a new epoch
        epochPayments[_recipient][_epoch] = _amount;
        totalAllocation += _amount;
        emit EpochAllocationSet(_recipient, _epoch, _amount);
    }

    function _updateAndTransfer(uint256 _amount) private {
        totalClaimed += _amount;
        paymentToken.safeTransferFrom(fundsOwner, msg.sender, _amount);
    }

    function _startNextEpoch() private returns (uint256 nextEpoch) {
        uint256 currentEpochCache = currentEpoch;
        uint256 startTime = epochStartTimes[currentEpochCache];
        // For the first epoch allow immediate start; otherwise enforce minimum duration
        if (currentEpochCache != 0 && startTime + minEpochDuration >= block.timestamp) { revert CannotStartEpoch(currentEpochCache+1); }
        nextEpoch = currentEpochCache + 1;
        currentEpoch = nextEpoch;
        epochStartTimes[nextEpoch] = block.timestamp;
        emit NextEpochSet(nextEpoch);
    }
}