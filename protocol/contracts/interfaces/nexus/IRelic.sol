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

    struct RelicInfoView {
        uint256 enclaveId;
        Rarity rarity;
        uint128 xp;
        uint256[] shards;
    }

    event RarityXPThresholdSet(Rarity rarity, uint256 threshold);
    event RarityBaseUriSet(Rarity rarity, string uri);
    event RelicMinterSet(address indexed minter, bool allow);
    event ShardSet(address shard);
    event RelicXPSet(uint256 indexed relicId, uint256 xp);
    event ShardsEquipped(address indexed caller, uint256 indexed relicId, uint256[] shardIds, uint256[] amounts);
    event ShardsUnequipped(address indexed recipient, uint256 indexed relicId, uint256[] shardIds, uint256[] amounts);
    event AccountBlacklistSet(address indexed account, bool blacklist, uint256[] shardIds, uint256[] amounts);
    event EnclaveNameSet(uint256 id, string name);
    event NexusCommonSet(address nexusCommon);

    error InvalidParamLength();
    error CallerCannotMint(address msgSender);
    error InvalidRelic(uint256 relicId);
    error InsufficientShardBalance(uint256 actualBalance, uint256 requestedBalance);
    error NotEnoughShardBalance(uint256 equippedBalance, uint256 amount);
    error CannotBlacklist(uint256 relicId);
    error RelicWithBlacklistedShards();

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

    /* 
     * @notice Set blacklist for an account's Relic's Shards. Validation checks for account's Relic ownership.
     * Function checks and validates equipped shards before blacklisting.
     * @param account Account to blacklist
     * @param relicId Id of Relic
     * @param shardIds An array of Shard Ids
     * @param amounts An array of balances for each Shard Id to blacklist
     */
    function setBlacklistedShards(
        address account,
        uint256 relicId,
        uint256[] calldata shardIds,
        uint256[] calldata amounts
    ) external;

    /* 
     * @notice Whitelist for an account's Relic's Shards
     * Function checks there are no Shards blacklisted before whitelisting.
     * @param account Account to blacklist
     * @param relicId Id of Relic
     * @param blacklist If to blacklist account
     */
    function unsetBlacklistedShards(
        address account,
        uint256 relicId,
        uint256[] calldata shardIds,
        uint256[] calldata amounts
    ) external;

    /* 
     * @notice Set blacklist for an account's Relic. Validation checks Relic is owned by account
     * Set blacklist to false for whitelisting. Function checks there are no Shards blacklisted before whitelisting.
     * @param account Account to blacklist
     * @param relicId Id of Relic
     * @param blacklist If to blacklist account
     */
    function setBlacklistAccount(
        address account,
        uint256 relicId,
        bool blacklist
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
     * @notice Burn blacklisted Relic Shards.
     * Shard IDs may not be empty. 
     * @param account Address of account
     * @param relicId Relic Id
     * @param shardIds Shard Ids
     * @param amounts Amounts of shards
     */
    function burnBlacklistedRelicShards( // burnBlacklistedShards
        address account,
        uint256 relicId,
        uint256[] calldata shardIds,
        uint256[] calldata amounts
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
     * @notice Get Relic Info view
     * @param relicId Id of Relic
     * @return RelicInfoView
     */
    function getRelicInfo(uint256 relicId) external view returns (RelicInfoView memory info);

    /*
     * @notice Get equipped Shard IDs in a Relic
     * @param relicId ID of relic
     * @return Array of shards equipped in Relic
     */
    function getEquippedShardIds(uint256 relicId) external view returns (uint256[] memory);

    /*
     * @notice Set Nexus Common contract
     * @param _contract Address of Nexus Common
     */
    function setNexusCommon(address _contract) external;
}