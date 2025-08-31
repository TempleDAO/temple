pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (admin/VestingPayments.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IVestingPayments } from "contracts/interfaces/admin/IVestingPayments.sol";

import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleMath } from "contracts/common/TempleMath.sol";
import { PaymentBase } from "contracts/admin/PaymentBase.sol";
import { SafeCast } from "contracts/common/SafeCast.sol";

/**
 * @title Vesting Payments
 * @notice Vesting contract for contributors. Token is an arbitrary ERC20 token and allocations are set with createSchedules.
 * An account can have multiple vesting schedules. Vesting schedules can be revoked and canceled. When revoked, contributor
 * vest is updated at block timestamp. Contributor can later claim that amount.
 */
contract VestingPayments is IVestingPayments, PaymentBase {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using SafeCast for uint256;

    /// @inheritdoc IVestingPayments
    uint256 public override totalVestedAndUnclaimed;

    /// @inheritdoc IVestingPayments
    mapping(bytes32 id => VestingSchedule schedule) public override schedules;

    /// @inheritdoc IVestingPayments
    mapping(address => uint256) public override holdersVestingCount;

    /// @notice Vesting Ids
    EnumerableSet.Bytes32Set private _activeVestingIds;

    constructor(
        address _rescuer,
        address _executor,
        address _fundsOwner,
        address _paymentToken
    ) PaymentBase(_paymentToken, _fundsOwner, _rescuer, _executor) {
    }

    /// @inheritdoc IVestingPayments
    function createSchedules(
        VestingSchedule[] calldata _schedules 
    ) external override onlyElevatedAccess {
        if (_schedules.length == 0) { revert CommonEventsAndErrors.InvalidParam(); }
        uint256 _length = _schedules.length;
        VestingSchedule calldata _schedule;
        for (uint256 i; i < _length; ++i) {
            _schedule = _schedules[i];
            // distributed and revoked should be default values
            if (_schedule.distributed != 0) { revert CommonEventsAndErrors.InvalidParam(); }
            if (_schedule.revoked) { revert CommonEventsAndErrors.InvalidParam(); }
            if (_schedule.revokedReleasable != 0) { revert CommonEventsAndErrors.InvalidParam(); }
            if (_schedule.recipient == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
            if (_schedule.start < block.timestamp) { revert CommonEventsAndErrors.InvalidParam(); }
            if (_schedule.cliff <= _schedule.start) { revert CommonEventsAndErrors.InvalidParam(); }
            // total duration must be greater than cliff
            // duration must be more than difference from start to cliff
            if (_schedule.duration <= _schedule.cliff - _schedule.start) { revert CommonEventsAndErrors.InvalidParam(); }
            if (_schedule.amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }

            bytes32 vestingId = computeNextVestingScheduleIdForHolder(_schedule.recipient);
            schedules[vestingId] = _schedule;
            totalVestedAndUnclaimed += _schedule.amount;
            /// @dev very low possibility of duplicate vesting IDs generated but still checking. 
            if (!_activeVestingIds.add(vestingId)) { revert InvalidScheduleId(); }
            holdersVestingCount[_schedule.recipient] += 1;
            emit ScheduleCreated(vestingId, _schedule.recipient, _schedule.start, _schedule.cliff, _schedule.duration, _schedule.amount);
        }
    }   

    /// @inheritdoc IVestingPayments
    function revokeVesting(bytes32 _vestingId) external override onlyElevatedAccess {
        if (!isActiveVestingId(_vestingId)) { revert CommonEventsAndErrors.InvalidParam(); }
        VestingSchedule storage _schedule = schedules[_vestingId];
        if (block.timestamp >= _schedule.duration + _schedule.start) { revert FullyVested(); }
        /// @dev No need to check if `_schedule.revoked` because id is removed from _activeVestingIds so it will fail `isActiveVestingId`

        uint256 vestedNow = _getTotalVestedAtCurrentTime(_schedule);
        uint256 unvested = _schedule.amount - vestedNow;
        if (unvested > 0) {
            totalVestedAndUnclaimed -= unvested;
        }
        // Claimable delta at revoke time
        uint256 releasableNow = vestedNow - _schedule.distributed;
        // Persist per-schedule claimable checkpoint
        _schedule.revokedReleasable = releasableNow.encodeUInt128();

        uint256 unreleased = _schedule.amount - _schedule.distributed;
        _schedule.revoked = true;
        if (!_activeVestingIds.remove(_vestingId)) { revert CommonEventsAndErrors.InvalidParam(); }
        emit Revoked(_vestingId, _schedule.recipient, unreleased, totalVestedAndUnclaimed);
    }

    /// @inheritdoc IVestingPayments
    function computeNextVestingScheduleIdForHolder(
        address holder
    ) public view override returns (bytes32) {
        return
            computeVestingScheduleIdForAddressAndIndex(
                holder,
                holdersVestingCount[holder]
            );
    }

    /// @inheritdoc IVestingPayments
    function getVestingIdAtIndex(uint256 _index) external view override returns (bytes32 id) {
        if (_index >= _activeVestingIds.length()) { revert CommonEventsAndErrors.InvalidParam(); }
        id = _activeVestingIds.at(_index);
    }

    /// @inheritdoc IVestingPayments
    function release(bytes32 _vestingId) external override {
        VestingSchedule storage _schedule = schedules[_vestingId];
        if (_schedule.start == 0) { revert CommonEventsAndErrors.InvalidParam(); }
        if (_schedule.recipient != msg.sender) { revert CommonEventsAndErrors.InvalidAccess(); }
        if (_schedule.revoked) {
            uint256 amount = _schedule.revokedReleasable;
            if (amount > 0) {
                _schedule.revokedReleasable = 0;
                _release(_schedule, amount);
                emit Released(_vestingId, msg.sender, amount);
                return;
            }
        }
        if (!isActiveVestingId(_vestingId)) { revert CommonEventsAndErrors.InvalidParam(); }
        uint256 _releasableAmount = _calculateReleasableAmount(_schedule);
        if (_releasableAmount == 0) { revert FullyVested(); }
        _release(_schedule, _releasableAmount);
        emit Released(_vestingId, msg.sender, _releasableAmount);
    }

    /// @inheritdoc IVestingPayments
    function computeVestingScheduleIdForAddressAndIndex(
        address holder,
        uint256 index
    ) public pure override returns (bytes32) {
        return keccak256(abi.encodePacked(holder, index));
    }

    /// @inheritdoc IVestingPayments
    function isActiveVestingId(bytes32 _id) public view returns (bool) {
        return _activeVestingIds.contains(_id);
    }

    /// @inheritdoc IVestingPayments
    function isVestingRevoked(bytes32 _vestingId) external view override returns (bool) {
        return schedules[_vestingId].revoked;
    }

    /// @inheritdoc IVestingPayments
    function getSchedule(bytes32 _vestingId) external view override returns (VestingSchedule memory schedule) {
        schedule = schedules[_vestingId];
    }

    /// @inheritdoc IVestingPayments
    function getLastVestingScheduleForHolder(
        address _recipient
    ) external view override returns (VestingSchedule memory schedule) {
        uint256 vestingCount = holdersVestingCount[_recipient];
        if (vestingCount == 0) { return schedule; }
        schedule = schedules[
            computeVestingScheduleIdForAddressAndIndex(
                _recipient,
                vestingCount - 1
            )
        ];
    }

    /// @inheritdoc IVestingPayments
    function getVestingScheduleByAddressAndIndex(
        address recipient,
        uint256 index
    ) external view override returns (VestingSchedule memory) {
        return schedules[computeVestingScheduleIdForAddressAndIndex(recipient, index)];
    }

    /// @inheritdoc IVestingPayments
    function getTotalVestedAtCurrentTime(bytes32 _vestingId) external view override returns (uint256) {
        VestingSchedule memory _schedule = schedules[_vestingId];
        return _getTotalVestedAtCurrentTime(_schedule);
    }

    /// @inheritdoc IVestingPayments
    function getVestingSummary(
        bytes32[] calldata _ids
    ) external view override returns (VestingSummary[] memory summary) {
        uint256 _length = _ids.length;
        summary = new VestingSummary[](_length);
        VestingSchedule memory _schedule;
        for (uint256 i; i < _length; ++i) {
            _schedule = schedules[_ids[i]];
            summary[i] = VestingSummary(
                _schedule.recipient,
                _schedule.distributed,
                _calculateTotalVestedAt(_schedule, uint40(block.timestamp))
            );
        }
    }

    /// @inheritdoc IVestingPayments
    function getVestingIds() external view override returns (bytes32[] memory ids) {
        ids = _activeVestingIds.values();
    }

    /// @inheritdoc IVestingPayments
    function getReleasableAmount(bytes32 _vestingId) external view override returns (uint256) {
        VestingSchedule storage _schedule = schedules[_vestingId];
        return _calculateReleasableAmount(_schedule);
    }

    /// @inheritdoc IVestingPayments
    function getTotalVestedAt(bytes32 _vestingId, uint40 _at) external view override returns (uint256) {
        VestingSchedule memory _schedule = schedules[_vestingId];
        return _calculateTotalVestedAt(_schedule, _at);
    }

    function _getTotalVestedAtCurrentTime(VestingSchedule memory _schedule) private view returns (uint256) {
        return _calculateTotalVestedAt(_schedule, uint40(block.timestamp));
    }

    function _calculateReleasableAmount(
          VestingSchedule storage _schedule
    ) private view returns (uint256) {
        // if account schedule is revoked, return the persisted checkpoint claimable vested delta. This also avoids an arithmetic underflow
        return _schedule.revoked ? _schedule.revokedReleasable : _calculateTotalVestedAt(_schedule, uint40(block.timestamp)) - _schedule.distributed;
    }

    function _calculateTotalVestedAt(
        VestingSchedule memory _schedule,
        uint40 _releaseTime
    ) private pure returns (uint256) {
        if (_schedule.amount == 0) { return 0; }
        // below cliff
        if (_releaseTime <= _schedule.cliff) { return 0; }
        // if revoked, return total vested at time of revoke (distributed + checkpointed delta)
        if (_schedule.revoked) { return _schedule.revokedReleasable + _schedule.distributed; }

        // cliff is guaranteed to be greater than start from the checks in createSchedules
        // cap it to the vesting duration. Therefore _releaseTime is always greater than start.
        uint40 _elapsed = _releaseTime - _schedule.start;
        if (_elapsed > _schedule.duration) _elapsed = _schedule.duration;

        return TempleMath.mulDivRound(_schedule.amount, _elapsed, _schedule.duration, false);
    }

    function _release(VestingSchedule storage _schedule, uint256 _amount) private {
        _schedule.distributed += _amount.encodeUInt128();
        totalVestedAndUnclaimed -= _amount;
        paymentToken.safeTransferFrom(fundsOwner, _schedule.recipient, _amount);
    }
}
