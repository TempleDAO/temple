pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (nexus/IShard.sol)
interface IShard {
    /*
     * struct for partner mint information
     */
    struct PartnerMintInfo {
        uint256[] shardIds;
        uint256[] caps;
        uint256[] balances;
    }

    struct Recipe {
        uint256[] inputShardIds;
        uint256[] inputShardAmounts;
        uint256[] outputShardIds;
        uint256[] outputShardAmounts;
    }

    /*
     * burn batch blacklisted shards of account
     */
    function burnBatch(address account, uint256[] memory ids, uint256[] memory values) external;

    function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes memory data) external;

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values,
        bytes memory data
    ) external;

    function setPartnerAllowedShardId(address partner, uint256 shardId, bool allowed) external;

    function setTemplarMinter(address minter, bool allowed) external;

     function setPartnerAllowedShardIds(
        address partner,
        uint256[] memory shardIds,
        bool[] memory flags
    ) external;

    function setPartnerAllowedShardCaps(
        address partner,
        uint256[] memory shardIds,
        uint256[] memory caps
    ) external;

    function setRecipe(uint256 recipeId, Recipe calldata recipe) external;

    function deleteRecipe(uint256 recipeId) external;

    function setShardUri(uint256 shardId, string memory uri) external;

    function uri(uint256 shardId) external view returns (string memory);

    function transmute(uint256 recipeId) external;

    function partnerMint(address to, uint256 shardId, uint256 amount) external;

    function partnerBatchMint(address to, uint256[] memory shardIds, uint256[] memory amounts) external;

    function mint(address to, uint256 shardId, uint256 amount) external;

    function mintBatch(
        address to,
        uint256[] memory shardIds,
        uint256[] memory amounts
    ) external;

    function getPartnerMintsInfo(address partner) external view returns (PartnerMintInfo memory info);
}