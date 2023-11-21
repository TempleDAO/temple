pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/nexus/IShard.sol)

import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

interface IShard is IERC1155 {
    /*
     * struct for partner mint information
     */
    struct MintInfo {
        uint256 shardId;
        uint256 cap;
        uint256 balance;
    }

    struct Recipe {
        uint256[] inputShardIds;
        uint256[] inputShardAmounts;
        uint256[] outputShardIds;
        uint256[] outputShardAmounts;
    }

    event Transmuted(address indexed caller, uint256 recipeId);
    event ShardUriSet(uint256 indexed shardId, string uri);
    event RecipeSet(uint256 recipeId, Recipe recipe);
    event RecipeDeleted(uint256 recipeId);
    event MinterAllowedShardIdSet(address indexed partner, uint256 indexed shardId, bool allow);
    event MinterAllowedShardCapSet(address indexed minter, uint256 indexed shardId, uint256 cap);
    event NexusCommonSet(address nexusCommon);

    error CannotMint(uint256 shardId);
    error MintCapExceeded(uint256 cap, uint256 amount);
    error InvalidRecipe(uint256 recipeId);
    error InvalidParamLength();
    error ERC1155MissingApprovalForAll(address msgSender, address account);

    /*
     * @notice Enable minters to mint new shards, one after the next. If there are two minters and next shard ID
     * is 3, minter 1 and minter 2 can mint shard IDs 3 and 4 respectively
     * @param minters Minters to enable for new shards
     */
    function setNewMinterShards(
        address[] calldata minters
    ) external returns (uint256[] memory shards);

    /*
     * @notice Set the caps for shards minters can mint
     * cap is 0 by default which means unlimited
     * @param minter Address of the partner
     * @param shardIds Shard IDs
     * @param caps The maximum amount partner can mint for each shard
     */
    function setAllowedShardCaps(
        address minter,
        uint256[] calldata shardIds,
        uint256[] calldata caps
    ) external;

     /*
     * @notice Set multiple shard IDs that minter can mint. This is an explicit setting.
     * Shard ID must exist. To enable minter for a new shard, use functions setNewMinterShard and setNewMinterShards
     * @param minter Address of the minter
     * @param shardIds Shard IDs
     * @param flags Booleans for if the partner can mint shards
     */
    function setMinterAllowedShardIds(
        address minter,
        uint256[] calldata shardIds,
        bool[] calldata flags
    ) external;

     /*
     * @notice Burn batch shards. Overriden from base contract. 
     * Modified to allow Relic contract to burn blacklisted account shards.
     * @param account The account owning the shard
     * @param ids The shard IDs
     * @param values The amounts of each shard to burn
     */
    function burnBatch(address account, uint256[] memory ids, uint256[] memory values) external;

    /*
     * @notice Add a recipe for transmutation
     * @param recipe The recipe
     */
    function addRecipe(Recipe calldata recipe) external;

    /*
     * @notice Delete recipe
     * @param recipeId The recipe ID
     */
    function deleteRecipe(uint256 recipeId) external;

    /*
     * @notice Set uri string of shard ID
     * @param shardId The shard ID
     * @param uri The uri string
     * @return String uri of the shard ID
     */
    function setShardUri(uint256 shardId, string memory _uri) external;

    /*
     * @notice Get uri string of shard ID
     * @param shardId The shard ID
     * @return String uri of the shard ID
     */
    function uri(uint256 shardId) external view returns (string memory);

    /*
     * @notice Transmute caller shards to create a new shard using a recipe
     * Caller shards are burned and new shard(s) are minted to caller.
     * @param recipeId The ID of the recipe
     */
    function transmute(uint256 recipeId) external;

    /*
     * @notice Mint shards in batch for allowed minters. 
     * This is a guarded function which only allowed contracts/addresses can mint.
     * Function checks if receiving mint address is blacklisted by Relic contract.
     * @param to The address to mint to
     * @param shardIds The shard IDs
     * @param amounts The amount of each shard ID to mint
     */
    function mintBatch(
        address to,
        uint256[] memory shardIds,
        uint256[] memory amounts
    ) external;

    /*
     * @notice Get shard IDs a minter is allowed to mint
     * @param minter The minter with perms
     * @return Shard IDs array
     */
    function getMinterAllowedShardIds(address minter) external view returns (uint256[] memory);

    /*
     * @notice Get next Shard Id
     * @return ID
     */
    function nextTokenId() external view returns (uint256);

    /*
     * @notice Check if given ID is a valid shard ID
     * @param id The ID to check
     * @return If ID is a valid shard
     */
    function isShardId(uint256 id) external view returns (bool);

    /*
     * @notice Get information about a recipe
     * @param recipeId The ID of the recipe
     * @return Recipe information struct. see above
     */
    function getRecipeInfo(uint256 recipeId) external view returns (Recipe memory info);

    /*
     * @notice Get next Recipe Id
     * @return ID of Recipe
     */
    function nextRecipeId() external view returns (uint256);

    /*
     * @notice Get the information of a minter. 
     * Fucntion is not validating minter and reverting. Caller should check and handle zero values
     * @param minter The minter
     * @return MintInfo struct information of minter
     */
    function getMintInfo(address minter) external view returns (MintInfo[] memory info);

    /*
     * @notice Set Nexus Common contract
     * @param _contract Address of Nexus Common
     */
    function setNexusCommon(address _contract) external;

    /*
     * @notice Get cap value a partner can mint for Shard 
     * @param minter Partner
     * @param shardId Shard Id
     * @return Cap
     */
    function allowedShardCaps(address minter, uint256 shardId) external returns (uint256);

    /*
     * @notice Get mint balances minted by partner address
     * @param minter Partner
     * @param shardId Shard Id
     * @return Balance
     */
    function mintBalances(address minter, uint256 shardId) external returns (uint256);

    /*
     * @notice Get total mint balances for Shard
     * @param shardId ShardId
     * @return Total Shards
     */
    function totalShardMints(uint256 shardId) external returns (uint256);
}