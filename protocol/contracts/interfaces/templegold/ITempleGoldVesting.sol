pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/templegold/ITempleGoldVesting.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITempleGoldVesting {
    event Revoked(bytes32 _id, address indexed _recipient, uint256 _unreleased, uint256 _totalVested);
    event Released(bytes32 _id, address indexed _recipient, uint256 _amount);
    event ScheduleCreated(
        bytes32 _id, address indexed _recipient, uint32 _start,
        uint32 _cliff, uint32 _duration, uint128 _amount
    );
    event RecipientChanged(bytes32 _vestingId, address _oldRecipient, address indexed _recipient);
    event FundsOwnerSet(address indexed _fundsOwner);

    error VestingRevoked();
    error CannotRelease();
    error InvalidScheduleId();

    struct VestingSchedule {
        /// @notice cliff
        uint32 cliff;
        /// @notice Start time of vesting
        uint32 start;
        /// @notice Duration of vesting
        uint32 duration;
        /// @notice Amount of TGLD for whole vesting
        uint128 amount;
        /// @notice Amount of TGLD distributed to recipient
        uint128 distributed;
        /// @notice Recipient of vesting
        address recipient;
        /// @notice If vesting is revoked
        bool revoked;
    }

    struct VestingSummary {
        /// @notice Recipient of vesting
        address recipient;
        /// @notice distributed tgld
        uint128 distributed;
        /// @notice total vested at current block.timestamp
        uint128 vested;
        /// @notice total vested at end time of summary
        uint128 vestedAtEnd;
    }

    /// @notice The owner of the TGLD funds
    function fundsOwner() external view returns(address);

    /// @notice TGLD address
    function templeGold() external view returns(IERC20);

    /// @notice Total TGLD vested and unclaimed
    function totalVestedAndUnclaimed() external view returns (uint256);

    /**
     * @notice Get vesting schedule
     * @param _vestingId Vesting Id
     * @return VestingSchedule 
     */
    function getSchedule(bytes32 _vestingId) external view returns (VestingSchedule memory);

    /**
     * @notice Set funds owner
     * @param _fundsOwner Funds owner
     */
    function setFundsOwner(address _fundsOwner) external;

    /**
     * @notice Create multiple vesting schedules
     * @param _schedules Vesting schedules
     */
    function createSchedules(
        VestingSchedule[] calldata _schedules 
    ) external;

    // /**
    //  * @notice Change recipient
    //  * @param _vestingId Vesting Id.
    //  * @param _recipient Recipient address
    //  */
    // function changeRecipient(bytes32 _vestingId, address _recipient) external;

    /**
     * @notice Revoke vesting
     * @param _vestingId Vesting Id.
     * @param _revokeTimestamp Time to revoke
     */
    function revokeVesting(bytes32 _vestingId, uint32 _revokeTimestamp) external;

    /**
     * @notice Recover ERC20 token
     * @param _token Token address
     * @param _to Recipient address
     * @param _amount Amount to recover
     */
    function recoverToken(address _token, address _to, uint256 _amount) external;

    /**
     * @dev Computes the next vesting schedule identifier for a given account address.
     */
    function computeNextVestingScheduleIdForHolder(
        address _recipient
    ) external view returns (bytes32);

    /**
     * @notice Get vesting schedules count by recipient
     * @param _recipient Recipient address
     * @return Count
     */
    function getVestingSchedulesCountByRecipient(
        address _recipient
    ) external view returns (uint256);

    /**
     * @notice Get vesting Id at index from list of vesting Ids
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
     * @notice Release amount of tokens vested at current block timestamp. Caller must be recipient of vest
     * @param _vestingId Vesting Id
     * @param _amount Amount to release
     */
    function releaseAmount(bytes32 _vestingId, uint256 _amount) external;

    /**
     * @dev Computes the vesting schedule identifier for an address and an index.
     */
    function computeVestingScheduleIdForAddressAndIndex(
        address holder,
        uint256 index
    ) external pure returns (bytes32);

    /**
     * @dev Returns the last vesting schedule for a given holder address.
     */
    function getLastVestingScheduleForHolder(
        address _recipient
    ) external view returns (VestingSchedule memory);

    /**
     * @dev Returns vesting schedule by address and index
     */
    function getVestingScheduleByAddressAndIndex(
        address recipient,
        uint256 index
    ) external view returns (VestingSchedule memory);

    function getTotalVestingAtCurrentTime(bytes32 _vestingId) external view returns (uint256);

    /**
     * @notice Get vesting summary
     * @param _from From timestamp
     * @param _to To timestamp
     * @return summary Vesting summary 
     */
    function getVestingSummary(uint32 _from, uint32 _to) external view returns (VestingSummary[] memory summary);

    /**
     * @notice Get vesting Ids
     * @return ids Vesting Ids 
     */
    function getVestingIds() external view returns (bytes32[] memory ids);
    
    /**
     * @notice Get active vesting Ids
     * @return ids Vesting Ids 
     */
    function getActiveVestingIds() external view returns (bytes32[] memory ids);

    /**
     * @notice Get recipient vesting count
     * @param _recipient Recipient address
     * @return Count
     */
    function getRecipientVestingCount(address _recipient) external view returns (uint256);

    /**
     * @notice Check if id is acting vesting
     * @param vestingId Vesting Id
     * @return Bool
     */
    function isActiveVestingId(bytes32 vestingId) external view returns (bool);

    /**
     * @notice Check if vesting Id exists
     * @param _id Vesting Id
     * @return Bool
     */
    function vestingIdExists(bytes32 _id) external view returns (bool);

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
    function getTotalVestedAt(bytes32 _vestingId, uint32 _at) external view returns (uint256);

    /**
     * @notice Check if vesting is revoked
     * @param _vestingId Vesting Id
     * @return Bool
     */
    function isVestingRevoked(bytes32 _vestingId) external view returns (bool);
}