pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/admin/IVestingPayments.sol)

import { IPaymentBase } from "contracts/interfaces/admin/IPaymentBase.sol";

interface IVestingPayments is IPaymentBase {
    event Revoked(bytes32 _id, address indexed _recipient, uint256 _unreleased, uint256 _totalVested);
    event Released(bytes32 _id, address indexed _recipient, uint256 _amount);
    event ScheduleCreated(
        bytes32 _id, address indexed _recipient, uint40 _start,
        uint40 _cliff, uint40 _duration, uint128 _amount
    );
    event RecipientChanged(bytes32 _vestingId, address _oldRecipient, address indexed _recipient);

    error CannotRelease();
    error InvalidScheduleId();
    error FullyVested();
    error NoVesting();

    struct VestingSchedule {
        /// @notice cliff
        uint40 cliff;
        /// @notice Start time of vesting
        uint40 start;
        /// @notice Duration of vesting
        uint40 duration;
        /// @notice Amount of vesting token for whole vesting
        uint128 amount;
        /// @notice Amount of vesting token distributed to recipient
        uint128 distributed;
        /// @notice Recipient of vesting
        address recipient;
        /// @notice If vesting is revoked
        bool revoked;
    }

    struct VestingSummary {
        /// @notice Recipient of vesting
        address recipient;
        /// @notice distributed vesting token
        uint128 distributed;
        /// @notice total vested at current block.timestamp
        uint128 vested;
    }

    /// @notice When an account is revoked, record the releasable amount for later when they claim
    function revokedAccountsReleasable(address account) external view returns (uint256);

    /// @notice Total vesting token vested and unclaimed
    function totalVestedAndUnclaimed() external view returns (uint256);

    /// @notice Recipient vesting counts for generating IDs. An account can have multiple vesting schedules
    function holdersVestingCount(address holder) external view returns (uint256);
    
    /**
     * @notice Get vesting schedule
     * @param _vestingId Vesting Id
     * @return VestingSchedule 
     */
    function getSchedule(bytes32 _vestingId) external view returns (VestingSchedule memory);

    /**
     * @notice Create multiple vesting schedules
     * @param _schedules Vesting schedules
     */
    function createSchedules(
        VestingSchedule[] calldata _schedules 
    ) external;

    /**
     * @notice Revoke vesting
     * @param _vestingId Vesting Id
     */
    function revokeVesting(bytes32 _vestingId) external;

    /**
     * @dev Computes the next vesting schedule identifier for a given account address.
     * @param _recipient Recipient address
     */
    function computeNextVestingScheduleIdForHolder(
        address _recipient
    ) external view returns (bytes32);

    /**
     * @notice Get vesting Id at index from list of vesting Ids
     * @dev When a vesting item is revoked, the index changes after the enumerable set swap and pop.
     * @dev Client should use `getVestingIds()` to get an updated list of ids, before calling this function.
     * @param _index Index
     * @return id Bytes32 Id
     */
    function getVestingIdAtIndex(
        uint256 _index
    ) external view returns (bytes32 id);

    /**
     * @notice Release tokens vested at current block timestamp. Caller must be recipient of vest
     * @param _vestingId Vesting Id
     */
    function release(bytes32 _vestingId) external;

    /**
     * @dev Computes the vesting schedule identifier for an address and an index.
     */
    function computeVestingScheduleIdForAddressAndIndex(
        address holder,
        uint256 index
    ) external pure returns (bytes32);

    /**
     * @notice Returns the last vesting schedule for a given holder address.
     * @param _recipient Recipient address
     * @return VestingSchedule
     */
    function getLastVestingScheduleForHolder(
        address _recipient
    ) external view returns (VestingSchedule memory);

    /**
     * @notice Returns vesting schedule by address and index
     * @param recipient Recipient
     * @param index Index
     * @return VestingSchedule
     */
    function getVestingScheduleByAddressAndIndex(
        address recipient,
        uint256 index
    ) external view returns (VestingSchedule memory);

    /**
     * @notice Returns the total vesting at block timestamp of a vesting schedule
     * @dev The returned value does not subtract the distributed amount
     * @param _vestingId Vesting Id
     * @return Total vest
     */
    function getTotalVestingAtCurrentTime(bytes32 _vestingId) external view returns (uint256);

   /**
     * @notice Get vesting summary
     * @param _ids Vesting Ids
     * @return summary Vesting summary 
     */
    function getVestingSummary(
        bytes32[] memory _ids
    ) external view returns (VestingSummary[] memory summary);

    /**
     * @notice Get vesting Ids
     * @return ids Vesting Ids 
     */
    function getVestingIds() external view returns (bytes32[] memory ids);

    /**
     * @notice Check if vesting Id exists
     * @param _id Vesting Id
     * @return Bool
     */
    function isActiveVestingId(bytes32 _id) external view returns (bool);

    /**
     * @notice Get releasable amount
     * @param _vestingId Vesting Id
     * @return Amount
     */
    function getReleasableAmount(bytes32 _vestingId) external view returns (uint256);

    /**
     * @notice Get total amount vested for an Id at timestamp
     * @param _vestingId Vesting Id
     * @param _at At timestamp
     * @return Total vested
     */
    function getTotalVestedAt(bytes32 _vestingId, uint40 _at) external view returns (uint256);

    /**
     * @notice Check if vesting is revoked
     * @param _vestingId Vesting Id
     * @return Bool
     */
    function isVestingRevoked(bytes32 _vestingId) external view returns (bool);
}