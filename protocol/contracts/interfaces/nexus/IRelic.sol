pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/nexus/IRelic.sol)

import { IERC721A } from "./IERC721A.sol";

interface IRelic {
    enum Rarity {
        Common,
        Uncommon,
        Rare,
        Epic,
        Legendary
    }

    enum Enclave {
        Chaos,
        Mystery,
        Logic,
        Order,
        Structure
    }

    struct RelicInfo {
        // Enclave enclave;
        uint256 enclaveId;
        Rarity rarity;
        uint128 xp;
        /// @notice shards equipped to this contract. can extract owner of relic from ownerOf(relicId)
        mapping(uint256 => uint256) equippedShards;
    }

    event RarityXPThresholdSet(Rarity rarity, uint256 threshold);
    event RarityBaseUriSet(Rarity rarity, string uri);
    event RelicMinterSet(address indexed minter, bool allow);
    event ShardSet(address shard);
    event RelicXPSet(uint256 indexed relicId, uint256 xp);
    event ShardEquipped(address indexed caller, uint256 indexed relicId, uint256 indexed shardId, uint256 amount);
    event ShardsEquipped(address indexed caller, uint256 indexed relicId, uint256[] shardIds, uint256[] amounts);
    event ShardUnequipped(address indexed caller, uint256 indexed relicId, uint256 indexed shardId, uint256 amount);
    event ShardsUnequipped(address indexed recipient, uint256 indexed relicId, uint256[] shardIds, uint256[] amounts);
    event AccountBlacklistSet(address indexed account, bool blacklist, uint256[] shardIds, uint256[] amounts);
    event EnclaveNameSet(uint256 id, string name);

    error InvalidParamLength();
    error CallerCannotMint(address msgSender);
    error InvalidRelic(uint256 relicId);
    error InvalidAddress(address invalidAddress);
    error InsufficientShardBalance(uint256 actualBalance, uint256 requestedBalance);
    error ZeroAddress();
    error InvalidOwner(address invalidOwner);
    error NotEnoughShardBalance(uint256 equippedBalance, uint256 amount);

    /*
     * @notice Get balance of address
     * @param owner Address to check balance for
     */
    // function balanceOf(address owner) external view returns (uint256);

    /*
     * @notice Check owner of a relic
     * @param tokenId Relic Id
     */
    // function ownerOf(uint256 tokenId) external view returns (address);

    /*
     * @notice Set shard contract
     * @param _shard Shard contract
     */
    function setShard(address _shard) external;

    /*
     * @notice Set relic minter
     * @param minter Address to mint relics
     * @param allow If minter is allowed to mint
     */
    function setRelicMinter(address minter, bool allow) external;

    /*
     * @notice Set XP threshold for rarities
     * @param rarities Rarity array
     * @param thresholds Thresholds for XP
     */
    function setXPRarityThresholds(
        Rarity[] calldata rarities,
        uint256[] calldata thresholds
    ) external;

    /*
     * @notice Set base URI for relic rarity
     * @param rarity Rarity
     * @param uri URI for relic rarity
     */
    function setBaseUriRarity(Rarity rarity, string memory uri) external;

    /* @notice Set blacklist for an account with or without shards.
     * If no shards are given, the account will only be blacklisted from
     * minting new relics
     * if flag is true, blacklist will set account and shards to true. Else, false.
     * @param account Account to blacklist
     * @param blacklist If to blacklist account
     * @param shardIds Shard IDs
     * @param amounts Amount to blacklist for each shard
     */
    function setBlacklistAccount(
        address account,
        bool blacklist,
        uint256 relicId,
        uint256[] memory shardIds,
        uint256[] memory amounts
    ) external;

    /*
     * @notice Set XP for a relic
     * @param relicId ID of relic
     * @param xp XP to set
     */
    function setRelicXP(uint256 relicId, uint256 xp) external;

     /*
     * @notice Get relics owned by owner
     * @param owner Address to check for ownership
     * @return _ownerRelics Array of relics
     */
    function relicsOfOwner(address _owner) external view returns (uint256[] memory ownerRelics);

    /*
     * @notice Get balances of shards equipped by relic
     * @param relicId ID of relic
     * @param shardIds Shard IDs
     * @return balances Balances of shards equipped in relic
     */
    function getBalanceBatch(
        uint256 relicId,
        uint256[] memory shardIds
    ) external view returns(uint256[] memory balances);

    /*
     * @notice Mint Relic. Function checks if recipient address is blacklisted
     * @param to Address of recipient
     * @param enclaveId Enclave ID
     */
    function mintRelic(address to, uint256 enclaveId) external;

    /*
     * @notice Batch equip shards to a relic
     * @param relicId ID of relic
     * @param shardIds Shard IDs
     * @return amounts Balances of shards to equip
     */
    function batchEquipShards(
        uint256 relicId,
        uint256[] memory shardIds,
        uint256[] memory amounts
    ) external;
    
    /*
     * @notice Batch unequip shards from relic
     * @param relicId ID of relic
     * @param shardIds Shard IDs
     * @return amounts Balances of shards to unequip
     */
    function batchUnequipShards(
        uint256 relicId,
        uint256[] memory shardIds,
        uint256[] memory amounts
    ) external;
     /*
     * @notice Get total relics minted
     * @return uint256 Amount of relics minted
     */
    function totalMinted() external view returns (uint256);
    /*
     * @notice Recover tokem sent to contract by error
     * @param token Address of token
     * @param to Recipient of token amount
     * @return amount Amount of token to recover
     */
    function recoverToken(address token, address to, uint256 amount) external;
    /*
     * @notice Burn blacklisted account shards.
     * Shard IDs may not be empty. In this case, use setBlacklistAccount
     * @param account Address of account
     * @param whitelistAfterBurn If to whitelist account after burning of shards
     * @return balances Balances of shards equipped in relic
     */
    function burnBlacklistedAccountShards(
        address account,
        bool whitelistAfterBurn,
        uint256 relicId,
        uint256[] memory shardIds
    ) external;
    /*
     * @notice Get URI of rarity
     * @param rarity Rarity type
     * @return uri URI
     */
    function getRarityBaseUri(Rarity rarity) external view returns(string memory uri);
    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * [EIP section](https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified)
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30000 gas.
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
    /*
     * @notice Check if an account is blacklisted
     * @param account Account
     * @return Boolean if account is blacklisted
     */
    function blacklistedAccounts(address account) external view returns (bool);
    /**
     * @dev Returns the Uniform Resource Identifier (URI) for `tokenId` token.
     */
    function tokenURI(uint256 tokenId) external view returns (string memory);

     /*
     * @notice Checkpoint the rarity of a relic. This function is open to external calls.
     * @param relicId ID of relic
     */
    function checkpointRelicRarity(uint256 relicId) external;

    /*
     * @notice Get next token Id
     * @return uint256 Next token Id
     */
    function nextTokenId() external view returns (uint256);

    /*
     * @notice Get amount of equipped shards in a relic
     * @param relicId ID of relic
     * @param shardId Id of shard
     * @return Equipped shard amount
     */
    function getEquippedShardAmount(
        uint256 relicId,
        uint256 shardId)
     external view returns (uint256);

    /*
     * @notice Get equipped Shard IDs in a Relic
     * @param relicId ID of relic
     * @return Array of shards equipped in Relic
     */
    function getEquippedShardIDs(uint256 relicId) external view returns (uint256[] memory);

    /*
     * @notice Set enclave ID to name mapping
     * @param id enclave ID
     * @param name Name of Enclave
     */
    function setEnclaveName(uint256 id, string memory name) external;

    /*
     * @notice Check if id is valid Enclave ID
     * @param enclaveId The ID to check
     * @return Bool if valid
     */
    function isValidEnclaveId(uint256 enclaveId) external view returns (bool);
}