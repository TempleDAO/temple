pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (admin/EpochPayments.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IEpochPayments } from "contracts/interfaces/admin/IEpochPayments.sol";

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { PaymentBase } from "contracts/admin/PaymentBase.sol";

/**
 * @title Epoch Payments contract.
 * @notice Epochs increase incrementally. Epoch allocations are set once for an epoch and subsequent updates
 * for the same epoch are done using `updateEpochPayments`. Updating can set new allocations or update existing allocations.
 */
contract EpochPayments is IEpochPayments, PaymentBase {
    using SafeERC20 for IERC20;

    /// @inheritdoc IEpochPayments
    uint256 public override totalAllocation;

    /// @inheritdoc IEpochPayments
    uint256 public override totalClaimed;

    /// @inheritdoc IEpochPayments
    uint256 public override currentEpoch;

    /// @inheritdoc IEpochPayments
    uint256 public override minEpochDuration;

    /// @inheritdoc IEpochPayments
    mapping(address recipient => mapping(uint256 epoch => uint256 amount)) public override epochPayments;

    /// @inheritdoc IEpochPayments
    mapping(address recipient => mapping(uint256 epoch => bool claimed)) public override claimedEpochs;

    /// @inheritdoc IEpochPayments
    mapping(uint256 epoch => uint256 startTime) public override epochStartTimes;

    constructor(
        address _rescuer,
        address _executor,
        address _fundsOwner,
        address _paymentToken
    ) TempleElevatedAccess(_rescuer, _executor) PaymentBase(_paymentToken, _fundsOwner) {
    }

    /// @inheritdoc IEpochPayments
    function setEpochPayments(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external override onlyElevatedAccess {
        // attempt to start next epoch
        uint256 epoch = _startNextEpoch();
        uint256 _length = recipients.length;
        if (_length == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        if (_length != amounts.length) { revert AllocationsLengthMismatch(); }
        for (uint256 i; i < _length; ++i) {
            _setEpochAllocation(epoch, recipients[i], amounts[i]);
        }
    }

    /// @inheritdoc IEpochPayments
    function updateEpochPayments(
        uint256 epoch,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external override onlyElevatedAccess {
        if (epochStartTimes[epoch] == 0) { revert InvalidEpoch(epoch); }
        uint256 _length = recipients.length;
        if (_length == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        if (_length != amounts.length) { revert AllocationsLengthMismatch(); }
        address recipient;
        for (uint256 i; i < _length; ++i) {
            // check if recipient has already claimed before update
            recipient = recipients[i];
            if (claimedEpochs[recipient][epoch]) { revert AlreadyClaimed(recipient, epoch); }
            _setEpochAllocation(epoch, recipient, amounts[i]);
        }
    }

    /// @inheritdoc IEpochPayments
    function setMinimumEpochDuration(uint256 duration) external override onlyElevatedAccess {
        if (duration == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        minEpochDuration = duration;
        emit MinimumEpochDurationSet(duration);
    }

    /// @inheritdoc IEpochPayments
    function claimEpoch(uint256 epoch) external override {
        if (epochStartTimes[epoch] == 0) { revert InvalidEpoch(epoch); }
        if (claimedEpochs[msg.sender][epoch]) { revert AlreadyClaimed(msg.sender, epoch); }
        uint256 _amount = epochPayments[msg.sender][epoch];
        if (_amount == 0) { revert ZeroClaimable(); }

        claimedEpochs[msg.sender][epoch] = true;
        totalClaimed += _amount;
        paymentToken.safeTransferFrom(fundsOwner, msg.sender, _amount);
        emit ClaimedEpoch(msg.sender, epoch, _amount);
    }

    function _setEpochAllocation(uint256 _epoch, address _recipient, uint256 _amount) private {
        if (_recipient == address(0)) { revert CommonEventsAndErrors.InvalidAddress();}
        // Checking if the recipient has already claimed is a responsibility of the caller of this function
        uint256 prev = epochPayments[_recipient][_epoch];
        if (_amount == prev) { revert SameAllocationAmount(); }

        epochPayments[_recipient][_epoch] = _amount;
        if (_amount > prev) {
            totalAllocation += (_amount - prev);
        } else {
            totalAllocation -= (prev - _amount);
        }
        emit EpochAllocationSet(_recipient, _epoch, _amount);
    }

    function _startNextEpoch() private returns (uint256 nextEpoch) {
        uint256 currentEpochCache = currentEpoch;
        uint256 startTime = epochStartTimes[currentEpochCache];
        // For the first epoch allow immediate start; otherwise enforce minimum duration
        if (currentEpochCache != 0 && block.timestamp <= startTime + minEpochDuration) { revert CannotStartEpoch(currentEpochCache+1); }
        nextEpoch = currentEpochCache + 1;
        currentEpoch = nextEpoch;
        epochStartTimes[nextEpoch] = block.timestamp;
        emit NextEpochSet(nextEpoch);
    }
}
