pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (admin/TeamPayments.sol)

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { TempleMath } from "contracts/common/TempleMath.sol";
import { ITeamPayments } from "contracts/interfaces/admin/ITeamPayments.sol";
import { PaymentBase } from "contracts/admin/PaymentBase.sol";

/**
 * @title Team Payments
 * @notice New team payments contract
 */
contract TeamPayments is ITeamPayments, PaymentBase, TempleElevatedAccess {
    using SafeERC20 for IERC20;

    /// @notice Total allocation, claimed and unclaimed
    uint256 public totalAllocation;
    /// @notice Total Claimed
    uint256 public totalClaimed;
    /// @notice Payments for recipients. Amount per second stream
    mapping(address recipient => Payment payment) public payments;
    /// @notice Epoch payments. variable payments
    mapping(address recipient => mapping(uint256 epoch => uint256 amount)) public epochPayments;
    /// @notice Claimed epochs
    mapping(address recipient => mapping(uint256 epoch => bool claimed)) public claimedEpochs;


    constructor(
        address _rescuer,
        address _executor,
        address _fundsOwner,
        address _paymentToken
    ) TempleElevatedAccess(_rescuer, _executor){
        fundsOwner = _fundsOwner;
        paymentToken = IERC20(_paymentToken);
    }

    /**
     * @notice Set funds owner
     * @dev Function visibility is public to match parent function
     * @param _fundsOwner Funds owner
     */
    function setFundsOwner(address _fundsOwner) public override onlyElevatedAccess {
        super.setFundsOwner(_fundsOwner);
    }

    /**
     * @notice Set payment token for fixed and epoch payments
     * @dev Function visibility is public to match parent function
     * @param _token Payment token 
     */
    function setPaymentToken(address _token) public override onlyElevatedAccess {
        super.setPaymentToken(_token);
    }

    /**
     * @notice Set fixed payments
     * @param _recipients Recipients array
     * @param _payments Amounts array to set
     */
    function setPayments(
        address[] calldata _recipients,
        Payment[] calldata _payments
    ) external override onlyElevatedAccess {
        uint256 _length = _payments.length;
        if (_length != _recipients.length) { revert CommonEventsAndErrors.InvalidParam(); }
        for (uint i; i < _length; ++i) {
            _setPayment(_recipients[i], _payments[i]);
        }
    }

    /**
     * @notice Set epoch payments
     * @param epoch Epoch
     * @param recipients Recipients array
     * @param amounts Amounts array to set
     */
    function setEpochPayments(
        uint256 epoch,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external override onlyElevatedAccess {
        if (epoch == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        uint256 _length = recipients.length;
        if (_length != amounts.length) { revert AllocationsLengthMismatch(); }
        for (uint i; i < _length; ++i) {
            _setEpochAllocation(epoch, recipients[i], amounts[i]);
        }
    }

    /**
     * @notice Revoke payment for contributor
     * @dev Accumulated amount at block.timestamp is transferred to contributor
     * @param _recipient Recipient
     */
    function revokePayment(address _recipient) external override onlyElevatedAccess {
        if (_recipient == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        // validate
        Payment storage _payment = payments[_recipient];
        if (_payment.isCancelled) { revert CommonEventsAndErrors.InvalidParam(); }

        // get remaining amount
        uint256 _amount = _getReleasableAmount(_payment);

        // cancel payment
        _payment.isCancelled = true;
        uint256 _unreleased = _payment.amount - (_payment.claimed + _amount);
        totalAllocation -= _unreleased;

        // transfer remaining amount
        if (_amount > 0) {
            totalClaimed += _amount;
            _payment.claimed += uint128(_amount);
            paymentToken.safeTransferFrom(fundsOwner, _recipient, _amount);
        }
        emit CancelledPayment(_recipient, _payment.claimed, _unreleased);
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
        if (claimedEpochs[recipient][epoch]) { revert AlreadyClaimed(); }
        uint256 _amount = epochPayments[recipient][epoch];
        if (_amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        epochPayments[recipient][epoch] = 0;
        claimedEpochs[recipient][epoch] = true;
        totalAllocation -= _amount;
        emit CancelledEpochPayment(recipient, epoch, _amount);
    }

    /**
     * @notice Claim payment (type fixed payment)
     */
    function claim() external override {
        Payment storage _payment = payments[msg.sender];
        if (_payment.isCancelled) { revert PaymentCancelled(); }
        if (_payment.amount == 0) { revert NoPayment(); }
        uint256 _amount = _getReleasableAmount(_payment);
        if (_amount == 0) { revert NothingClaimable(); }
        _payment.claimed += uint128(_amount);
        _updateAndTransfer(_amount);
        emit ClaimedFixed(msg.sender, _amount, _payment.claimed);
    }

    /**
     * @notice Claim amount of payment
     * @param _amount Amount to claim
     */
    function claimAmount(uint256 _amount) external override {
        if (_amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        Payment storage _payment = payments[msg.sender];
        if (_payment.isCancelled) { revert PaymentCancelled(); }
        if (_payment.amount == 0) { revert NoPayment(); }
        uint256 _releasableAmount = _getReleasableAmount(_payment);
        if (_amount > _releasableAmount) { revert CommonEventsAndErrors.InvalidParam(); }
        _payment.claimed += uint128(_amount);
        _updateAndTransfer(_amount);
        emit ClaimedFixed(msg.sender, _amount, _payment.claimed);
    }

    /**
     * @notice Claim for epoch
     * @param epoch Epoch
     */
    function claimEpoch(uint256 epoch) external override {
        if (epoch == 0) { revert CommonEventsAndErrors.InvalidParam(); }
        if (claimedEpochs[msg.sender][epoch]) { revert AlreadyClaimed(); }
        uint256 _amount = epochPayments[msg.sender][epoch];
        if (_amount == 0) { revert NothingClaimable(); }

        claimedEpochs[msg.sender][epoch] = true;
        _updateAndTransfer(_amount);
        emit ClaimedEpoch(msg.sender, epoch, _amount);
    }

    /**
     * @notice Recover ERC20 token
     * @param _token Token address
     * @param _to Recipient address
     * @param _amount Amount to recover
     */
    function recoverToken(address _token, address _to, uint256 _amount) public override onlyElevatedAccess {
        super.recoverToken(_token, _to, _amount);
    }

    /**
     * @notice Get claimable payment
     * @param recipient Recipient
     * @return Claimable payment
     */
    function getClaimablePayment(address recipient) external override view returns (uint256) {
        return _getReleasableAmount(payments[recipient]);
    }

    /**
     * @notice Get claimable payment at a provided time
     * @param recipient Recipient
     * @param at Provided time
     * @return Claimable payment
     */
    function getClaimablePaymentAt(address recipient, uint256 at) external override view returns (uint256) {
        Payment storage _payment = payments[recipient];
        if ((at <= _payment.start) || _payment.isCancelled) {
            return 0;
        } else {
            uint256 _total = _calculateTotalPayoutAt(_payment, uint32(at));
            return _total - _payment.claimed;
        }
    }

    /**
     * @notice Get payment info
     * @param recipient Recipient
     * @return Payment info
     */
    function getPaymentInfo(address recipient) external override view returns (Payment memory) {
        return payments[recipient];
    }

    function _setPayment(address _recipient, Payment calldata _payment) private {
        if (_payment.start == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        if (_payment.duration == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        if (_payment.amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        if (_payment.claimed > 0) { revert CommonEventsAndErrors.InvalidParam(); }
        if (_payment.isCancelled) { revert CommonEventsAndErrors.InvalidParam(); }
        if (_recipient == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        /// @dev admin should revoke payment first
        if (payments[_recipient].amount != 0) { revert CommonEventsAndErrors.InvalidAddress(); }
        payments[_recipient] = _payment;
        totalAllocation += _payment.amount;
        emit PaymentSet(_recipient, _payment.start, _payment.duration+_payment.start, _payment.amount);
    }

    function _setEpochAllocation(uint256 _epoch, address _recipient, uint256 _amount) private {
        if (_amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        if (_recipient == address(0)) { revert CommonEventsAndErrors.InvalidAddress();}
        epochPayments[_recipient][_epoch] = _amount;
        totalAllocation += _amount;
        emit EpochAllocationSet(_recipient, _epoch, _amount);
    }

    function _getReleasableAmount(Payment storage _payment) private view returns (uint256) {
        if ((block.timestamp <= _payment.start) || _payment.isCancelled) {
            return 0;
        } else {
            uint256 _total = _calculateTotalPayoutAt(_payment, uint32(block.timestamp));
            return _total - _payment.claimed;
        }
    }

    function _updateAndTransfer(uint256 _amount) private {
        totalClaimed += _amount;
        paymentToken.safeTransferFrom(fundsOwner, msg.sender, _amount);
    }

    function _calculateTotalPayoutAt(
        Payment storage _payment,
        uint32 _releaseTime
    ) private view returns (uint256) {
        uint256 _elapsed = _getElapsedTime(_payment.start, _releaseTime, _payment.duration);
        uint256 _total = TempleMath.mulDivRound(_payment.amount, _elapsed, _payment.duration, false);
        return _total;
    }

    function _getElapsedTime(uint32 _start, uint32 _end, uint32 _duration) private pure returns (uint32) {
        return _end - _start > _duration ? _duration : _end - _start;
    }
}