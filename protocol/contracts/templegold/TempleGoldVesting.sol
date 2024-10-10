pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/TempleGoldVesting.sol)


import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { TempleMath } from "contracts/common/TempleMath.sol";
import { ITempleGoldVesting } from "contracts/interfaces/templegold/ITempleGoldVesting.sol";

contract TempleGoldVesting is ITempleGoldVesting, TempleElevatedAccess {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    ///@notice The owner of the TGLD funds
    address public override fundsOwner;
    ///@notice TGLD address
    IERC20 public immutable override templeGold;
    ///@notice Total TGLD vested and unclaimed
    uint256 public override totalVested;
    ///@notice Schdules for recipients
    mapping(bytes32 id => VestingSchedule schedule) public schedules;
    ///@notice Recipient vesting counts for generating IDs. An account can have multiple vesting schedules
    mapping(address => uint256) private _holdersVestingCount;
    ///@notice Maximum amount of TGLD vested for revoked accounts
    mapping(bytes32 id => uint256 amount) public revokedMaxAmounts;
    ///@notice Vesting Ids
    EnumerableSet.Bytes32Set private _vestingIds;
    ///@notice Active vesting Ids
    EnumerableSet.Bytes32Set private _activeVestingIds;

    constructor(
        address _rescuer,
        address _executor,
        address _fundsOwner,
        address _templeGold
    ) TempleElevatedAccess(_rescuer, _executor){
        fundsOwner = _fundsOwner;
        templeGold = IERC20(_templeGold);
    }

    /**
     * @notice Set funds owner
     * @param _fundsOwner Funds owner
     */
    function setFundsOwner(address _fundsOwner) external override onlyElevatedAccess {
        if (_fundsOwner == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        /// @dev Elevated access should revoke approval from old `fundsOwner` for this contract
        fundsOwner = _fundsOwner;
        emit FundsOwnerSet(_fundsOwner);
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
        VestingSchedule memory _schedule;
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
            totalVested += _schedule.amount;
            /// @dev duplicate vesting IDs will not be generated from `computeNextVestingScheduleIdForHolder` so ignoring returned value from `add`
            _vestingIds.add(vestingId);
            _activeVestingIds.add(vestingId);
            _holdersVestingCount[_schedule.recipient] += 1;
            emit ScheduleCreated(vestingId, _schedule.recipient, _schedule.start, _schedule.cliff, _schedule.duration, _schedule.amount);
        }
    }

    /**
     * @notice Change recipient
     * @param _vestingId Vesting Id.
     * @param _recipient Recipient address
     */
    function changeRecipient(bytes32 _vestingId, address _recipient) external override onlyElevatedAccess {
        if (!_vestingIdExists(_vestingId)) { revert CommonEventsAndErrors.InvalidParam(); }
        if (_recipient == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }

        VestingSchedule storage _schedule = schedules[_vestingId];
        address _oldRecipient = _schedule.recipient;
        if (_oldRecipient == _recipient) { revert CommonEventsAndErrors.InvalidParam(); }
        _schedule.recipient = _recipient;
        // create new id
        bytes32 _newVestingId = computeNextVestingScheduleIdForHolder(_recipient);
        schedules[_newVestingId] = _schedule;
        delete schedules[_vestingId];

        _vestingIds.remove(_vestingId);
        _activeVestingIds.remove(_vestingId);
        _vestingIds.add(_newVestingId);
        _activeVestingIds.add(_newVestingId);
        _holdersVestingCount[_oldRecipient] -= 1;
        _holdersVestingCount[_recipient] += 1;
        emit RecipientChanged(_newVestingId, _oldRecipient, _recipient);
    }

    /**
     * @notice Revoke vesting
     * @param _vestingId Vesting Id.
     * @param _revokeTimestamp Time to revoke
     */
    function revokeVesting(bytes32 _vestingId, uint32 _revokeTimestamp) external override onlyElevatedAccess {
        if (_revokeTimestamp < block.timestamp) { revert CommonEventsAndErrors.InvalidParam(); }
        VestingSchedule storage _schedule = schedules[_vestingId];
        if (!_vestingIdExists(_vestingId)) { revert CommonEventsAndErrors.InvalidParam(); }
        if (_revokeTimestamp >= _schedule.duration + _schedule.start) { revert CommonEventsAndErrors.InvalidParam(); }
        if (_schedule.revoked) { revert VestingRevoked(); }
        uint256 _vestedAmount = _calculateReleasableAmount(_schedule);
        if (_vestedAmount > 0) {
            _release(_schedule, _vestedAmount);
            emit Released(_vestingId, _schedule.recipient, _vestedAmount);
        }
        uint256 unreleased = _schedule.amount - _schedule.distributed;
        // update new revoke duration
        if (_revokeTimestamp > block.timestamp) {
            uint256 maxAmount = _calculateTotalVestedAt(_schedule, _revokeTimestamp);
            revokedMaxAmounts[_vestingId] = maxAmount;
            uint256 remainingAmount = maxAmount - _calculateTotalVestedAt(_schedule, uint32(block.timestamp));
            unreleased -= remainingAmount;
        }
        totalVested -= unreleased;
        _schedule.revoked = true;
        _activeVestingIds.remove(_vestingId);
        emit Revoked(_vestingId, _schedule.recipient, unreleased, totalVested);
    }

    /**
     * @notice Recover ERC20 token
     * @param _token Token address
     * @param _to Recipient address
     * @param _amount Amount to recover
     */
    function recoverToken(address _token, address _to, uint256 _amount) external override onlyElevatedAccess {
        emit CommonEventsAndErrors.TokenRecovered(_to, _token, _amount);
        IERC20(_token).safeTransfer(_to, _amount);
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
                _holdersVestingCount[_recipient]
            );
    }

    /**
     * @notice Get vesting schedules count by recipient
     * @param _recipient Recipient address
     * @return Count
     */
    function getVestingSchedulesCountByRecipient(
        address _recipient
    ) external view override returns (uint256) {
        return _holdersVestingCount[_recipient];
    }

    /**
     * @notice Get vesting Id at index from list of vesting Ids
     * @param _index Index
     * @return id Bytes32 Id
     */
    function getVestingIdAtIndex(
        uint256 _index
    ) external view override returns (bytes32 id) {
        if (_index >= _vestingIds.length()) { return id; }
        return _vestingIds.at(_index);
    }

    /**
     * @notice Release tokens vested at current block timestamp. Caller must be recipient of vest
     * @param _vestingId Vesting Id
     */
    function release(bytes32 _vestingId) external override {
        if (!_vestingIdExists(_vestingId)) { revert CommonEventsAndErrors.InvalidParam(); }
        VestingSchedule storage _schedule = schedules[_vestingId];
        uint256 _releasableAmount  = _validateRelease(_schedule, _vestingId);
        _release(_schedule, _releasableAmount);
        emit Released(_vestingId, msg.sender, _releasableAmount);
    }

    /**
     * @notice Release amount of tokens vested at current block timestamp. Caller must be recipient of vest
     * @param _vestingId Vesting Id
     * @param _amount Amount to release
     */
    function releaseAmount(bytes32 _vestingId, uint256 _amount) external override {
        if (_amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        if (!_vestingIdExists(_vestingId)) { revert CommonEventsAndErrors.InvalidParam(); }
        VestingSchedule storage _schedule = schedules[_vestingId];
        uint256 _releasableAmount = _validateRelease(_schedule, _vestingId);
        if (_amount > _releasableAmount) { revert CannotRelease(); }
        _release(_schedule, _amount);
        emit Released(_vestingId, msg.sender, _amount);
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
    function vestingIdExists(bytes32 _id) external view override returns (bool) {
        return _vestingIdExists(_id);
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
     * @dev Returns the last vesting schedule for a given holder address.
     */
    function getLastVestingScheduleForHolder(
        address _recipient
    ) external view override returns (VestingSchedule memory) {
        return
            schedules[
                computeVestingScheduleIdForAddressAndIndex(
                    _recipient,
                    _holdersVestingCount[_recipient] - 1
                )
            ];
    }

    /**
     * @dev Returns vesting schedule by address and index
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
        if (!_vestingIdExists(_vestingId)) { return 0; }
        VestingSchedule memory _schedule = schedules[_vestingId];
        if (block.timestamp <= _schedule.start) { return 0; }
        if (_schedule.revoked) { 
            uint256 _maxAmount = revokedMaxAmounts[_vestingId];
            if (_maxAmount == 0) { return 0; }
            ///@dev account is revoked. return only releasable amount
            return _calculateReleasableAmountRevoked(schedules[_vestingId], _maxAmount);
        }
        uint32 _elapsed = _getElapsedTime(_schedule.start, uint32(block.timestamp), _schedule.duration);
        return TempleMath.mulDivRound(_schedule.amount, _elapsed, _schedule.duration, false);
    }

    /**
     * @notice Get vesting summary
     * @param _from From timestamp
     * @param _to To timestamp
     * @return summary Vesting summary 
     */
    function getVestingSummary(uint32 _from, uint32 _to) external view override returns (VestingSummary[] memory summary) {
        bytes32[] memory ids = _activeVestingIds.values();
        uint256 _length = ids.length;
        summary = new VestingSummary[](_length);
        VestingSchedule memory _schedule;
        for (uint256 i; i < _length; ++i) {
            _schedule = schedules[ids[i]];
            if (_schedule.start >= _from && _schedule.start + _schedule.duration <= _to) {
                summary[i] = VestingSummary(
                    _schedule.recipient,
                    _schedule.distributed,
                    uint128(_calculateTotalVestedAt(_schedule, uint32(block.timestamp))),
                    uint128(_calculateTotalVestedAt(_schedule, _to))
                );
            }
        }
    }

    /**
     * @notice Get vesting Ids
     * @return ids Vesting Ids 
     */
    function getVestingIds() external view override returns (bytes32[] memory ids) {
        ids = _vestingIds.values();
    }
    
    /**
     * @notice Get active vesting Ids
     * @return ids Vesting Ids 
     */
    function getActiveVestingIds() external view override returns (bytes32[] memory ids) {
        ids = _activeVestingIds.values();
    }

    /**
     * @notice Check if id is acting vesting
     * @param vestingId Vesting Id
     * @return Bool
     */
    function isActiveVestingId(bytes32 vestingId) external view override returns (bool) {
        return _activeVestingIds.contains(vestingId);
    }

    /**
     * @notice Get recipient vesting count
     * @param _recipient Recipient address
     * @return Count
     */
    function getRecipientVestingCount(address _recipient) external view override returns (uint256) {
        return _holdersVestingCount[_recipient];
    }

    /**
     * @notice Get releasable amount
     * @param _vestingId Vesting Id
     * @return Amount
     */
    function getReleasableAmount(bytes32 _vestingId) external view override returns (uint256) {
        if(!_vestingIdExists(_vestingId)) { return 0; }
        VestingSchedule memory _schedule = schedules[_vestingId];
        if (_schedule.revoked) {
            uint256 _maxAmount = revokedMaxAmounts[_vestingId];
            if (_maxAmount == 0) { return 0; }
            return _calculateReleasableAmountRevoked(schedules[_vestingId], _maxAmount);
        } else {
            return _calculateReleasableAmount(schedules[_vestingId]);
        }
    }

    /**
     * @notice Get total amount vested for an Id at timestamp
     * @param _vestingId Vesting Id
     * @param _at At timestamp
     * @return Total vested
     */
    function getTotalVestedAt(bytes32 _vestingId, uint32 _at) external view override returns (uint256) {
        if(!_vestingIdExists(_vestingId)) { return 0; }
        VestingSchedule memory _schedule = schedules[_vestingId];
        if (block.timestamp <= _schedule.start) { return 0; }
        return _calculateTotalVestedAt(_schedule, _at);
    }

    function _calculateReleasableAmount(
        VestingSchedule memory _schedule
    ) private view returns (uint256) {
        if ((block.timestamp <= _schedule.cliff) || _schedule.revoked) {
            return 0;
        } else {
            uint256 _vested = TempleMath.mulDivRound(_schedule.amount, block.timestamp - _schedule.start, _schedule.duration, false);
            return _vested - _schedule.distributed;
        }
    }

    function _validateRelease(VestingSchedule storage _schedule, bytes32 _vestingId) private view returns (uint256 _releasableAmount) {
        if (_schedule.recipient != msg.sender) { revert CommonEventsAndErrors.InvalidAccess(); }
        _releasableAmount = _calculateReleasableAmount(_schedule);
        if (_schedule.revoked) {
            uint256 _maxAmount = revokedMaxAmounts[_vestingId];
            if (_maxAmount == 0) { revert VestingRevoked(); }
            uint256 _releasableAmountRevoked =_calculateReleasableAmountRevoked(_schedule, _maxAmount);
            if (_releasableAmountRevoked == 0) { revert VestingRevoked(); }
            _releasableAmount = _releasableAmountRevoked;
        }
    }

    function _calculateReleasableAmountRevoked(
        VestingSchedule memory _schedule,
        uint256 _maxAmount
    ) private view returns (uint256) {
        uint256 _vested = TempleMath.mulDivRound(_schedule.amount, block.timestamp - _schedule.start, _schedule.duration, false);
        if (_vested > _maxAmount) { _vested = _maxAmount; }
        return _schedule.distributed >= _vested ? 0 : _vested - _schedule.distributed;
    }

    function _calculateTotalVestedAt(
        VestingSchedule memory _schedule,
        uint32 _releaseTime
    ) private pure returns (uint256) {
        uint256 _elapsed = _getElapsedTime(_schedule.start, _releaseTime, _schedule.duration);
        uint256 _vested = TempleMath.mulDivRound(_schedule.amount, _elapsed, _schedule.duration, false);
        return _vested;
    }

    function _release(VestingSchedule storage _schedule, uint256 _amount) private {
        _schedule.distributed += uint128(_amount);
        totalVested -= _amount;
        templeGold.safeTransferFrom(fundsOwner, _schedule.recipient, _amount);
    }

    function _getElapsedTime(uint32 _start, uint32 _end, uint32 _duration) private pure returns (uint32) {
        return _end - _start > _duration ? _duration : _end - _start;
    }

    function _vestingIdExists(bytes32 _id) private view returns (bool) {
        return _vestingIds.contains(_id);
    }
}