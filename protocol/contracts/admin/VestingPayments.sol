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


/**
 * @title Vesting Payments
 * @notice Vesting contract for contributors. Token is an arbitrary ERC20 token and allocations are set with createSchedules.
 *  An account can have multiple vesting schedules. Vesting schedules can be revoked and canceled.
 */
contract VestingPayments is IVestingPayments, PaymentBase, TempleElevatedAccess {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    /// @notice Total vesting token vested and unclaimed
    uint256 public override totalVestedAndUnclaimed;

    /// @notice Schdules for recipients
    mapping(bytes32 id => VestingSchedule schedule) public schedules;

    /// @notice Recipient vesting counts for generating IDs. An account can have multiple vesting schedules
    mapping(address => uint256) public holdersVestingCount;

    /// @notice Vesting Ids
    EnumerableSet.Bytes32Set private _activeVestingIds;

    constructor(
        address _rescuer,
        address _executor,
        address _fundsOwner,
        address _paymentToken
    ) TempleElevatedAccess(_rescuer, _executor) PaymentBase(_paymentToken) {
        fundsOwner = _fundsOwner;
    }

    /**
     * @notice Set funds owner
     * @param _fundsOwner Funds owner
     */
    function setFundsOwner(address _fundsOwner) external override onlyElevatedAccess {
        _setFundsOwner(_fundsOwner);
    }

    /**
     * @notice Create multiple vesting schedules
     * @param _schedules Vesting schedules
     */
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
            if(!_activeVestingIds.add(vestingId)) { revert InvalidScheduleId(); }
            holdersVestingCount[_schedule.recipient] += 1;
            emit ScheduleCreated(vestingId, _schedule.recipient, _schedule.start, _schedule.cliff, _schedule.duration, _schedule.amount);
        }
    }   

    /**
     * @notice Revoke vesting
     * @param _vestingId Vesting Id
     */
    function revokeVesting(bytes32 _vestingId) external override onlyElevatedAccess {
        if (!isActiveVestingId(_vestingId)) { revert CommonEventsAndErrors.InvalidParam(); }
        VestingSchedule storage _schedule = schedules[_vestingId];
        if (block.timestamp >= _schedule.duration + _schedule.start) { revert FullyVested(); }
        /// @dev No need to check if `_schedule.revoked` because id is removed from _activeVestingIds so it will fail `isActiveVestingId`
        
        uint256 unreleased = _schedule.amount - _schedule.distributed;
        totalVestedAndUnclaimed -= unreleased;
        _schedule.revoked = true;
        if(!_activeVestingIds.remove(_vestingId)) { revert CommonEventsAndErrors.InvalidParam(); }
        emit Revoked(_vestingId, _schedule.recipient, unreleased, totalVestedAndUnclaimed);
    }

    /**
     * @notice Recover ERC20 token
     * @dev function visibility made public to match parent function
     * @param _token Token address
     * @param _to Recipient address
     * @param _amount Amount to recover
     */
    function recoverToken(
        address _token,
        address _to,
        uint256 _amount
    ) external override onlyElevatedAccess {
        _recoverToken(_token, _to, _amount);
    }

    /**
     * @dev Computes the next vesting schedule identifier for a given account address.
     */
    function computeNextVestingScheduleIdForHolder(
        address _recipient
    ) public view override returns (bytes32) {
        return
            computeVestingScheduleIdForAddressAndIndex(
                _recipient,
                holdersVestingCount[_recipient]
            );
    }

    /**
     * @notice Get vesting Id at index from list of vesting Ids
     * @dev When a vesting item is revoked, the index changes after the enumerable set swap and pop.
     * @dev Client should use `getVestingIds()` to get an updated list of ids, before calling this function.
     * @param _index Index
     * @return id Bytes32 Id
     */
    function getVestingIdAtIndex(
        uint256 _index
    ) external view override returns (bytes32 id) {
        /// @dev revert if zero vesting Ids length
        if (_activeVestingIds.length() == 0) { revert NoVesting(); }
        /// @dev revert with an array out-of-bounds access if only `id = _activeVestingIds.at(_index);` is used
        id = _activeVestingIds.at(_index);
    }

    /**
     * @notice Release tokens vested at current block timestamp. Caller must be recipient of vest
     * @param _vestingId Vesting Id
     */
    function release(bytes32 _vestingId) external override {
        if(!isActiveVestingId(_vestingId)) { revert CommonEventsAndErrors.InvalidParam(); }
        VestingSchedule storage _schedule = schedules[_vestingId];
        if (_schedule.recipient != msg.sender) { revert CommonEventsAndErrors.InvalidAccess(); }
        uint256 _releasableAmount = _calculateReleasableAmount(_schedule);
        _release(_schedule, _releasableAmount);
        emit Released(_vestingId, msg.sender, _releasableAmount);
    }

    /**
     * @dev Computes the vesting schedule identifier for an address and an index.
     */
    function computeVestingScheduleIdForAddressAndIndex(
        address holder,
        uint256 index
    ) public pure override returns (bytes32) {
        return keccak256(abi.encodePacked(holder, index));
    }

    /**
     * @notice Check if vesting Id exists
     * @param _id Vesting Id
     * @return Bool
     */
     function isActiveVestingId(bytes32 _id) public view returns (bool) {
        return _activeVestingIds.contains(_id);
    }

    /**
     * @notice Check if vesting is revoked
     * @param _vestingId Vesting Id
     * @return Bool
     */
    function isVestingRevoked(bytes32 _vestingId) external view override returns (bool) {
        return schedules[_vestingId].revoked;
    }

    /**
     * @notice Get vesting schedule
     * @param _vestingId Vesting Id
     * @return schedule VestingSchedule 
     */
    function getSchedule(bytes32 _vestingId) external view override returns (VestingSchedule memory schedule) {
        schedule = schedules[_vestingId];
    }

    /**
     * @notice Returns the last vesting schedule for a given holder address.
     * @param _recipient Recipient address
     * @return schedule Vesting schedule
     */
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

    /**
     * @notice Returns vesting schedule by address and index
     * @param recipient Recipient
     * @param index Index
     * @return VestingSchedule
     */
    function getVestingScheduleByAddressAndIndex(
        address recipient,
        uint256 index
    ) external view override returns (VestingSchedule memory) {
        return schedules[computeVestingScheduleIdForAddressAndIndex(recipient, index)];
    }

    /**
     * @notice Get total vested amount at current block timestamp for vesting Id
     * @param _vestingId Vesting Id
     * @return Vested amount 
     */
    function getTotalVestingAtCurrentTime(bytes32 _vestingId) external view override returns (uint256) {
        VestingSchedule memory _schedule = schedules[_vestingId];
        if (_schedule.amount == 0) { return 0; }
        if (block.timestamp <= _schedule.start) { return 0; }
        if (_schedule.revoked) { return 0; }
        return _calculateTotalVestedAt(_schedule, uint40(block.timestamp));
    }

    /// @inheritdoc IVestingPayments
    function getVestingSummary(
        bytes32[] memory _ids
    ) external view override returns (VestingSummary[] memory summary) {
        uint256 _length = _ids.length;
        summary = new VestingSummary[](_length);
        VestingSchedule memory _schedule;
        for (uint256 i; i < _length; ++i) {
            _schedule = schedules[_ids[i]];
            summary[i] = VestingSummary(
                _schedule.recipient,
                _schedule.distributed,
                uint128(_calculateTotalVestedAt(_schedule, uint32(block.timestamp)))
            );
        }
    }

    /**
     * @notice Get vesting Ids
     * @return ids Vesting Ids 
     */
    function getVestingIds() external view override returns (bytes32[] memory ids) {
        ids = _activeVestingIds.values();
    }

    /**
     * @notice Get releasable amount
     * @param _vestingId Vesting Id
     * @return Amount
     */
    function getReleasableAmount(bytes32 _vestingId) external view override returns (uint256) {
        if(!isActiveVestingId(_vestingId)) { return 0; }
        VestingSchedule storage _schedule = schedules[_vestingId];
        return _calculateReleasableAmount(_schedule);
    }

    /**
     * @notice Get total amount vested for an Id at timestamp
     * @param _vestingId Vesting Id
     * @param _at At timestamp
     * @return Total vested
     */
    function getTotalVestedAt(bytes32 _vestingId, uint40 _at) external view override returns (uint256) {
        VestingSchedule memory _schedule = schedules[_vestingId];
        if (_schedule.amount == 0) { return 0; }
        if (_at <= _schedule.start) { return 0; }
        return _calculateTotalVestedAt(_schedule, _at);
    }

    function _calculateReleasableAmount(
          VestingSchedule storage _schedule
    ) private view returns (uint256) {
        if ((block.timestamp <= _schedule.cliff) || _schedule.revoked) {
            return 0;
        } else {
            uint256 _vested = _calculateTotalVestedAt(_schedule, uint40(block.timestamp));
            return _vested - _schedule.distributed;
        }
    }

    function _calculateTotalVestedAt(
        VestingSchedule memory _schedule,
        uint40 _releaseTime
    ) private pure returns (uint256) {
        uint256 _elapsed = _getElapsedTime(_schedule.start, _releaseTime, _schedule.duration);
        uint256 _vested = TempleMath.mulDivRound(_schedule.amount, _elapsed, _schedule.duration, false);
        return _vested;
    }

    function _release(VestingSchedule storage _schedule, uint256 _amount) private {
        _schedule.distributed += uint128(_amount);
        totalVestedAndUnclaimed -= _amount;
        paymentToken.safeTransferFrom(fundsOwner, _schedule.recipient, _amount);
    }
}