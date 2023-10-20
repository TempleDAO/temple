pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/nexus/IShard.sol)

interface IShard {
    /// @notice Enclave types
    enum Enclave {
        Chaos,
        Mystery,
        Logic,
        Order,
        Structure,
        None
    }

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
    event ShardEnclaveSet(uint256 enclaveId, uint256 indexed shardId);
    event ShardIdSet(uint256 indexed shardId, bool allow);
    event MinterAllowedShardIdSet(address indexed partner, uint256 indexed shardId, bool allow);
    event MinterAllowedShardCapSet(address indexed minter, uint256 indexed shardId, uint256 cap);
    event EnclaveNameSet(uint256 id, string name);

    error CannotMint(uint256 shardId);
    error MintCapExceeded(uint256 cap, uint256 amount);
    error InvalidRecipe(uint256 recipeId);
    error ZeroAddress();
    error InvalidParamLength();
    error InvalidAccess(address caller);
    error ERC1155MissingApprovalForAll(address msgSender, address account);

    /**
     * @dev See {IERC1155-safeBatchTransferFrom}.
     */
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values,
        bytes memory data
    ) external;

    /*
     * @notice Enable minters to mint new shards, one after the next. If there are two minters and next shard ID
     * is 3, minter 1 and minter 2 can mint shard IDs 3 and 4 respectively
     * @param minters Minters to enable for new shards
     */
    function setNewMinterShards(
        address[] calldata minters
    ) external returns (uint256[] memory shards);

    /*
     * @notice Set shard enclave
     * @param enclaveId Enclave ID
     * @param shardId Shard ID
     */
    function setShardEnclave(uint256 enclaveId, uint256 shardId) external;

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

    // function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes memory data) external;

    // function safeBatchTransferFrom(
    //     address from,
    //     address to,
    //     uint256[] memory ids,
    //     uint256[] memory values,
    //     bytes memory data
    // ) external;

    /*
     * @notice Set a recipe for transmutation
     * @param recipe The recipe
     */
    function setRecipe(Recipe calldata recipe) external;

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
    function setShardUri(uint256 shardId, string memory uri) external;

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
     * @notice Mint shard. This is a guarded function which only allows callers with perms to mint.
     * Function checks if receiving mint address is blacklisted by Relic contract.
     * If caps is set on shard ID for caller, new balance is checked.
     * @param to The address to mint to
     * @param shardId The shard ID
     * @param amount The amount of shard ID to mint
     */
    function mint(address to, uint256 shardId, uint256 amount) external;

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
     * @notice Set enclave ID to name mapping
     * @param id enclave ID
     * @param name Name of Enclave
     */
    function setEnclaveName(uint256 id, string memory name) external;

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
     * @notice Get shard IDs of an enclave
     * @param enclaveId The enclave ID
     * @return Shard IDs of enclave
     */
    function getEnclaveShards(uint256 enclaveId) external view returns (uint256[] memory);

    /*
     * @notice Determines if a shard ID belongs to an enclave
     * @param enclaveId The enclave ID
     * @param shardId The shard ID
     * @return True if shard ID belongs to enclave, else false.
     */
    function isEnclaveShard(uint256 enclaveId, uint256 shardId) external view returns (bool);

    /*
     * @notice Get the information of a minter. 
     * Fucntion is not validating minter and reverting. Caller should check and handle zero values
     * @param minter The minter
     * @return MintInfo struct information of minter
     */
    function getMintInfo(address minter) external view returns (MintInfo[] memory info);

    /*
     * @notice Get all enclave Ids
     * @return Enclave Ids
     */
    function getAllEnclaveIds() external view returns (uint256[] memory);

    /*
     * @notice Check if id is valid Enclave ID
     * @param enclaveId The ID to check
     * @return Bool if valid
     */
    function isValidEnclaveId(uint256 enclaveId) external view returns (bool);
}