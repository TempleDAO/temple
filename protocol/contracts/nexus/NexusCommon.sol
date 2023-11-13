pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (nexus/NexusCommon.sol)


import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { CommonEventsAndErrors } from "../common/CommonEventsAndErrors.sol";
import { ElevatedAccess } from "./access/ElevatedAccess.sol";
import { INexusCommon } from "../interfaces/nexus/INexusCommon.sol";
import { IShard } from "../interfaces/nexus/IShard.sol";

contract NexusCommon is INexusCommon, ElevatedAccess {
    using EnumerableSet for EnumerableSet.UintSet;

    IShard public shard;

    /// @notice each shard belongs to exactly 1 enclave. an enclave can have many shards
    mapping(uint256 => EnumerableSet.UintSet) private enclaveToShards;
    /// @notice reverse mapping a shard to its enclave
    mapping(uint256 => uint256) public override shardToEnclave;
    /// @notice set of enclave IDs added.
    EnumerableSet.UintSet private enclaveIds;
    /// @notice id to enclave name
    mapping(uint256 => string) public override enclaveNames;

    constructor(address _initialExecutor) ElevatedAccess(_initialExecutor) {}

    /*
     * @notice Set shard contract
     * @param _shard Shard contract
     */
    function setShard(address _shard) external override onlyElevatedAccess {
        if(_shard == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        shard = IShard(_shard);
        emit ShardSet(_shard);
    }

    /*
     * @notice Set enclave ID to name mapping
     * @param id enclave ID
     * @param name Name of Enclave
     */
    function setEnclaveName(uint256 id, string memory name) external override onlyElevatedAccess {
        if (id == 0) { revert CommonEventsAndErrors.InvalidParam(); }
        if (bytes(name).length == 0) { revert CommonEventsAndErrors.InvalidParam(); }
        enclaveNames[id] = name;
        enclaveIds.add(id);
        emit EnclaveNameSet(id, name);
    }

    /*
     * @notice Set shard enclave
     * @param enclaveId Enclave ID
     * @param shardId Shard ID
     */
    function setShardEnclave(uint256 enclaveId, uint256 shardId) external override onlyElevatedAccess {
        if (enclaveId == 0) { revert CommonEventsAndErrors.InvalidParam(); }
        if(bytes(enclaveNames[enclaveId]).length == 0) { revert CommonEventsAndErrors.InvalidParam(); }
        if (!shard.isShardId(shardId)) { revert CommonEventsAndErrors.InvalidParam(); }
        /// remove if shard already belongs to an enclave
        uint256 oldEnclaveId = shardToEnclave[shardId];
        enclaveToShards[oldEnclaveId].remove(shardId);

        // add shardId to enclave
        enclaveToShards[enclaveId].add(shardId);
        shardToEnclave[shardId] = enclaveId;
        emit ShardEnclaveSet(enclaveId, shardId);
    }

    /*
     * @notice Get shard IDs of an enclave
     * @param enclaveId The Enclave ID
     * @return Shard IDs of Enclave
     */
    function getEnclaveShards(uint256 enclaveId) external override view returns (uint256[] memory) {
        return enclaveToShards[enclaveId].values();
    }

    /*
     * @notice Get all enclave Ids
     * @return Enclave Ids
     */
    function getAllEnclaveIds() external override view returns (uint256[] memory ids) {
        ids = enclaveIds.values();
    }

    /*
     * @notice Check if enclave Id is valid
     * @param enclaveId Id of enclave
     * @return Bool
     */
    function isValidEnclaveId(uint256 enclaveId) external override view returns (bool) {
        return enclaveIds.contains(enclaveId);
    }
}