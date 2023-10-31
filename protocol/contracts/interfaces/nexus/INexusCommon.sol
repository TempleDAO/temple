pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/nexus/INexusCommon.sol)

interface INexusCommon {
    event ShardEnclaveSet(uint256 enclaveId, uint256 indexed shardId);
    event EnclaveNameSet(uint256 id, string name);
    event ShardSet(address indexed shard);

    /*
     * @notice Set shard contract
     * @param _shard Shard contract
     */
    function setShard(address _shard) external;

    /*
     * @notice Set enclave ID to name mapping
     * @param id enclave ID
     * @param name Name of Enclave
     */
    function setEnclaveName(uint256 id, string memory name) external;

    /*
     * @notice Set shard enclave
     * @param enclaveId Enclave ID
     * @param shardId Shard ID
     */
    function setShardEnclave(uint256 enclaveId, uint256 shardId) external;

    /*
     * @notice Get shard IDs of an enclave
     * @param enclaveId The Enclave ID
     * @return Shard IDs of Enclave
     */
    function getEnclaveShards(uint256 enclaveId) external view returns (uint256[] memory);

    /*
     * @notice Get all enclave Ids
     * @return Enclave Ids
     */
    function getAllEnclaveIds() external view returns (uint256[] memory ids);

    /*
     * @notice Check if enclave Id is valid
     * @param enclaveId Id of enclave
     * @return Bool
     */
    function isValidEnclaveId(uint256 enclaveId) external view returns (bool);

    /*
     * @notice Shard Id to Enclave Id. Reverse mapping a shard to its enclave
     * @param shardId Shard Id
     * @return Enclave Id
     */
    function shardToEnclave(uint256 shardId) external returns (uint256);

    /*
     * @notice Get enclave name from Shard Id
     * @param enclaveId Id of enclave
     * @return Enclave name
     */
    function enclaveNames(uint256 enclaveId) external returns (string memory);
}