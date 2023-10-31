pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (nexus/Relic.sol)


import { ERC721ACustom } from "../../nexus/ERC721ACustom.sol";
import { ERC1155Holder } from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import { ERC1155Receiver } from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Receiver.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC165 } from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { IERC721A } from "../../interfaces/nexus/IERC721A.sol";
import { CommonEventsAndErrors } from "../../common/CommonEventsAndErrors.sol";
import { IShard } from "../../interfaces/nexus/IShard.sol";
import { IRelic } from "../../interfaces/nexus/IRelic.sol";
import { INexusCommon } from "../../interfaces/nexus/INexusCommon.sol";


interface ITestnetShard is IShard {
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
}


contract TestnetRelic is IRelic, ERC721ACustom, ERC1155Holder {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    IShard public shard;
    INexusCommon public nexusCommon;

    uint256 private constant PER_MINT_QUANTITY = 0x01;
    bytes private constant ZERO_BYTES = "";

    /// @notice mapping for information about relic. relicId to RelicInfo
    mapping(uint256 => RelicInfo) private relicInfos;

    /// @notice base uris for different rarities
    mapping(Rarity => string) private baseUris;

    /// @notice XP thresholds for Relic rarity levels
    mapping(Rarity => uint256) public rarityXPThresholds;

    /// @notice callers who can update xp info for a relic
    mapping(address => bool) public xpControllers;

    /// @notice to keep track of blacklisted Relics and blacklisted Shard balances
    mapping(uint256 => mapping(uint256 => uint256)) public blacklistedRelicShards;
    mapping(address => bool) public blacklistedAccounts;
    /// @notice count of shards blacklisted for Relic
    mapping(uint256 => uint256) public blacklistedShardsCount;
    mapping(address => bool) public relicMinters;
    mapping(address => EnumerableSet.UintSet) private ownerRelics;
    /// @notice id to enclave name
    // mapping(uint256 => string) public enclaveNames;

    /// @notice operators for testnet
    mapping(address => bool) public operators;


    event OperatorSet(address operator, bool allow);

    error InvalidAccess(address account);

    struct RelicInfo {
        uint256 enclaveId;
        Rarity rarity;
        uint128 xp;
        /// @notice shards equipped to this contract. can extract owner of relic from ownerOf(relicId)
        mapping(uint256 => uint256) equippedShards;
        /// @notice keep track of equipped shards as set
        EnumerableSet.UintSet shards;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        address _nexusCommon
    ) ERC721ACustom(_name, _symbol) {
        operators[msg.sender] = true;
        nexusCommon = INexusCommon(_nexusCommon);
    }

    function setOperator(address operator, bool allow) external onlyOperator {
        operators[operator] = allow;
        emit OperatorSet(operator, allow);
    }

    /*
     * @notice Set Nexus Common contract
     * @param _contract Address of Nexus Common
     */
    function setNexusCommon(address _contract) external override onlyOperator {
        if (address(0) == _contract) { revert CommonEventsAndErrors.InvalidAddress(); }
        nexusCommon = INexusCommon(_contract);
        emit NexusCommonSet(_contract);
    }

    /*
     * @notice Set shard contract
     * @param _shard Shard contract
     */
    function setShard(address _shard) external onlyOperator {
        if (_shard == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        shard = IShard(_shard);
        emit ShardSet(address(shard));
    }

    /*
     * @notice Override _baseURI. Modified to use relicId. URI of NFT depends on rarity of relic.
     * @param enclave Enclave
     * @param shardId Shard ID
     */
    function _baseURI(uint256 relicId) internal view override returns (string memory uri) {
        /// get uri using relicId rarity
        RelicInfo storage relicInfo = relicInfos[relicId];
        uri = string(
            abi.encodePacked(
                baseUris[relicInfo.rarity],
                _toString(uint256(relicInfo.enclaveId))
            )
        );
    }

    /**
     * @dev Returns the Uniform Resource Identifier (URI) for `tokenId` token.
     */
    function tokenURI(uint256 tokenId) public view override(ERC721ACustom, IRelic) returns (string memory) {
        if (!_exists(tokenId)) _revert(URIQueryForNonexistentToken.selector);

        return _baseURI(tokenId);
    }

    /*
     * @notice Set threshold for XP rarity
     * @param rarity Rarity
     * @param threshold Threshold value for rarity
     */
    function setXPRarityThreshold(Rarity rarity, uint256 threshold) external onlyOperator {
        if (uint8(rarity) > uint8(Rarity.Legendary)) { revert CommonEventsAndErrors.InvalidParam(); }
        rarityXPThresholds[rarity] = threshold;
        emit RarityXPThresholdSet(rarity, threshold);
    }

    /*
     * @notice Set relic minter
     * @param minter Address to mint relics
     * @param allow If minter is allowed to mint
     */
    function setRelicMinter(address minter, bool allow) external onlyOperator {
        if (minter == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        relicMinters[minter] = allow;
        emit RelicMinterSet(minter, allow);
    }

    /*
     * @notice Set XP threshold for rarities
     * @param rarities Rarity array
     * @param thresholds Thresholds for XP
     */
    function setXPRarityThresholds(
        Rarity[] calldata rarities,
        uint256[] calldata thresholds
    ) external onlyOperator {
        uint256 _length = rarities.length;
        if (_length != thresholds.length) { revert InvalidParamLength(); }
        for(uint i; i < _length;) {
            uint256 _threshold = thresholds[i];
            Rarity _rarity = rarities[i];
            if (uint8(_rarity) > uint8(Rarity.Legendary)) { revert CommonEventsAndErrors.InvalidParam(); }
            rarityXPThresholds[_rarity] = _threshold;
            emit RarityXPThresholdSet(_rarity, _threshold);
            unchecked {
                ++i;
            }
        }
    }

    /*
     * @notice Set base URI for relic rarity
     * @param rarity Rarity
     * @param uri URI for relic rarity
     */
    function setBaseUriRarity(Rarity rarity, string memory _uri) external onlyOperator {
        baseUris[rarity] = _uri;
        emit RarityBaseUriSet(rarity, _uri);
    }
 
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
        uint256 relicId,
        bool blacklist
    ) external override onlyOperator {
        _validateBlacklisting(account, relicId);
        if (blacklist) {
            blacklistedAccounts[account] = true;
        } else {
            if (blacklistedShardsCount[relicId] > 0) { revert CannotBlacklist(relicId); }
            blacklistedAccounts[account] = false;
        }
    }

    function setBlacklistedShards(
        address account,
        uint256 relicId,
        uint256[] calldata shardIds,
        uint256[] calldata amounts
    ) external override onlyOperator {
        _validateBlacklisting(account, relicId);
        uint256 _length = shardIds.length;
        if (_length != amounts.length) { revert InvalidParamLength(); }
        uint256 shardId;
        uint256 amount;
        /// @dev only valid in storage because it contains a (nested) mapping.
        mapping(uint256 => uint256) storage equippedShards = relicInfos[relicId].equippedShards;
        uint256 shardsCount;
        uint256 equippedShardBalance;
        /// cache for gas savings
        mapping(uint256 => uint256) storage blacklistedRelic = blacklistedRelicShards[relicId];
        for(uint i; i < _length;) {
            shardId = shardIds[i];
            amount = amounts[i];
            /// blacklist only equipped shards
            equippedShardBalance = equippedShards[shardId];
            /// @dev checks that we don't blacklist more than equipped. condition holds if shardIds are duplicated in calldata
            if (equippedShardBalance < amount + blacklistedRelic[shardId]) {
                revert NotEnoughShardBalance(equippedShardBalance, amount + blacklistedRelic[shardId]);
            }
            blacklistedRelic[shardId] = amount;
            shardsCount += amount;
            unchecked {
                ++i;
            }
        }
        blacklistedShardsCount[relicId] += shardsCount;
        /// @dev blacklist account if at least one shard is set. This check holds true for case shardIds is empty
        if (shardsCount > 0) {
            blacklistedAccounts[account] = true;
        }
    }

    function unsetBlacklistedShards(
        address account,
        uint256 relicId,
        uint256[] calldata shardIds,
        uint256[] calldata amounts
    ) external override onlyOperator {
        _validateBlacklisting(account, relicId);
        uint256 _length = shardIds.length;
        uint256 shardId;
        uint256 amount;
        uint256 shardsCount;
        uint256 blacklistedRelicShardsCache;
        mapping(uint256 => uint256) storage blacklistedRelic = blacklistedRelicShards[relicId];
        for (uint i; i < _length;) {
            shardId = shardIds[i];
            amount = amounts[i];
            blacklistedRelicShardsCache = blacklistedRelic[shardId];
            if (amount > blacklistedRelicShardsCache) { revert CommonEventsAndErrors.InvalidParam(); }
            shardsCount += amount;
            unchecked {
                blacklistedRelic[shardId] = blacklistedRelicShardsCache - amount;
                ++i;
            }
        }
        blacklistedShardsCount[relicId] -= shardsCount;
        if (blacklistedShardsCount[relicId] == 0) {
            blacklistedAccounts[account] = false;
        }
    }

    function _validateBlacklisting(address account, uint256 relicId) internal view {
        /// @dev keep for cases of burned relics even if `account != ownerOf(relicId)` satisfies both cases.
        if (account == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        if (!_exists(relicId)) _revert(URIQueryForNonexistentToken.selector);
        if (account != ownerOf(relicId)) { revert CommonEventsAndErrors.InvalidParam(); }
    }
    
    // function _blacklist(
    //     address account,
    //     bool blacklist,
    //     uint256 shardId,
    //     uint256 amount
    // ) internal returns (bool pending){
    //     if (blacklist) {
    //             blacklistedAccountShards[account][shardId] = amount;
    //         } else { 
    //             // removing from blacklist
    //             if (amount >= blacklistedAccountShards[account][shardId]) {
    //                 blacklistedAccountShards[account][shardId] = 0;
    //             } else {
    //                 blacklistedAccountShards[account][shardId] -= amount;
    //                 pending = true;
    //             }
    //         }
    // }

    /*
     * @notice Set XP for a relic
     * @param relicId ID of relic
     * @param xp XP to set
     */
     // todo change to elevatedAccess
    function setRelicXP(uint256 relicId, uint256 xp) external onlyOperator {
        if(!_exists(relicId)) { revert InvalidRelic(relicId); }
        RelicInfo storage relicInfo = relicInfos[relicId];
        // leave open for when xp could go down or up
        relicInfo.xp = uint128(xp);
        emit RelicXPSet(relicId, xp);
        checkpointRelicRarity(relicId);
    }

    function checkpointRelicRarity(uint256 relicId) public {
        if(!_exists(relicId)) { revert InvalidRelic(relicId); }
        RelicInfo storage relicInfo = relicInfos[relicId];
        uint128 xp = relicInfo.xp;
        // Rarity.Common is default value. so skip check
        if (xp >= rarityXPThresholds[Rarity.Legendary]) {
            relicInfo.rarity = Rarity.Legendary;
        } else if (xp >= rarityXPThresholds[Rarity.Epic]) {
            relicInfo.rarity = Rarity.Epic;
        } else if (xp >= rarityXPThresholds[Rarity.Rare]) {
            relicInfo.rarity = Rarity.Rare;
        } else if (xp >= rarityXPThresholds[Rarity.Uncommon]) {
            relicInfo.rarity = Rarity.Uncommon;
        }
    }

    /*
     * @notice Get relics owned by owner
     * @param owner Address to check for ownership
     * @return _ownerRelics Array of relics
     */
    function relicsOfOwner(address owner) external view returns (uint256[] memory _ownerRelics) {
        return ownerRelics[owner].values();
    }

    /*
     * @notice Get balances of shards equipped by relic
     * @param relicId ID of relic
     * @param shardIds Shard IDs
     * @return balances Balances of shards equipped in relic
     */
    function getEquippedShards(
        uint256 relicId,
        uint256[] memory shardIds
    ) external view returns(uint256[] memory balances) {
        if(!_exists(relicId)) { revert InvalidRelic(relicId); }
        uint256 _length = shardIds.length;
        balances = new uint256[](_length);
        uint256 shardId;
        /// only valid in storage because it contains nested mapping
        RelicInfo storage relicInfo = relicInfos[relicId];
        for (uint i; i < _length;) {
            shardId = shardIds[i];
            balances[i] = relicInfo.equippedShards[shardId];
            unchecked {
                ++i;
            }
        }
    }

    /*
     * @notice Mint Relic. Function checks if recipient address is blacklisted
     * @param to Address of recipient
     * @param enclaveId Enclave ID
     */
    function mintRelic(
        address to,
        uint256 enclaveId
    ) external isRelicMinter notBlacklisted(to) {
        if (to == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        if (!nexusCommon.isValidEnclaveId(enclaveId)) { revert CommonEventsAndErrors.InvalidParam(); }

        uint256 nextTokenId_ = _nextTokenId();
        RelicInfo storage relicInfo = relicInfos[nextTokenId_];
        relicInfo.enclaveId = enclaveId;
        // relicInfo.rarity = Rarity.Common;
        // relicInfo.xp = uint128(0);
        
        ownerRelics[to].add(nextTokenId_);
        /// user can mint relic anytime after sacrificing temple and getting whitelisted. one at a time
        _safeMint(to, PER_MINT_QUANTITY, ZERO_BYTES);
    }

    /*
     * @notice Batch equip shards to a relic
     * @param relicId ID of relic
     * @param shardIds Shard IDs
     * @return amounts Balances of shards to equip
     */
    function batchEquipShards(
        uint256 relicId,
        uint256[] calldata shardIds,
        uint256[] calldata amounts
    ) external onlyRelicOwner(relicId) notBlacklisted(msg.sender) {
        uint256 _length = shardIds.length;
        if (_length != amounts.length) { revert InvalidParamLength(); }
        // using batch transfer as validation msg.sender owns all shards
        shard.safeBatchTransferFrom(msg.sender, address(this), shardIds, amounts, ZERO_BYTES);
        // question change to assembly?
        uint256 shardId;
        RelicInfo storage relicInfo = relicInfos[relicId];
        for (uint i; i < _length;) {
            shardId = shardIds[i];
            relicInfo.equippedShards[shardId] += amounts[i];
            unchecked {
                ++i;
            }
        }
        emit ShardsEquipped(msg.sender, relicId, shardIds, amounts);
    }

    /*
     * @notice Batch unequip shards from relic
     * @param relicId ID of relic
     * @param shardIds Shard IDs
     * @return amounts Balances of shards to unequip
     */
    function batchUnequipShards(
        uint256 relicId,
        uint256[] calldata shardIds,
        uint256[] calldata amounts
    ) external onlyRelicOwner(relicId) notBlacklisted(msg.sender) {
        uint256 _length = shardIds.length;
        if (_length != amounts.length) { revert InvalidParamLength(); }
        uint256 equippedAmountCache;
        uint256 shardId;
        uint256 amount;
        RelicInfo storage relicInfo = relicInfos[relicId];
        for (uint i; i < _length;) {
            shardId = shardIds[i];
            equippedAmountCache = relicInfo.equippedShards[shardId];
            amount = amounts[i];
            if (equippedAmountCache < amount) { revert InsufficientShardBalance(equippedAmountCache, amount); }

            unchecked {
                relicInfo.equippedShards[shardId] -= amount;
                ++i;
            }
        }
        shard.safeBatchTransferFrom(address(this), msg.sender, shardIds, amounts, ZERO_BYTES);
        emit ShardsUnequipped(msg.sender, relicId, shardIds, amounts);
    }

    /*
     * @notice Get total relics minted
     * @return uint256 Amount of relics minted
     */
    function totalMinted() external view returns (uint256) {
        return _totalMinted();
    }

    /*
     * @notice Get next token Id
     * @return uint256 Next token Id
     */
    function nextTokenId() public view returns (uint256) {
        return _nextTokenId();
    }

    /*
     * @notice Recover tokem sent to contract by error
     * @param token Address of token
     * @param to Recipient of token amount
     * @return amount Amount of token to recover
     */
    function recoverToken(address token, address to, uint256 amount) external onlyOperator {
        if (to == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        IERC20(token).safeTransfer(to, amount);
        emit CommonEventsAndErrors.TokenRecovered(to, token, amount);
    }

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
    ) external override onlyOperator {
        // account could be whitelisted or blacklisted. important check is account's Relic shards are blacklisted
        _validateBlacklisting(account, relicId);
        uint256 _length = shardIds.length;
        if (_length == 0) { revert InvalidParamLength(); }
        mapping(uint256 => uint256) storage equippedShards = relicInfos[relicId].equippedShards;
        mapping(uint256 => uint256) storage blacklistedShards = blacklistedRelicShards[relicId];
        uint256 shardId;
        uint256 amount;
        uint256 equippedShardBalance;
        uint256 blacklistedShardsCountCache;
        for(uint i; i < _length;) {
            shardId = shardIds[i];
            amount = amounts[i];
            // update tracking variables
            blacklistedShards[shardId] -= amount;
            equippedShardBalance = equippedShards[shardId] - amount;
            blacklistedShardsCountCache = blacklistedShardsCount[relicId];
            blacklistedShardsCount[relicId] = blacklistedShardsCountCache - amount;
            /// @dev avoid stack too deep
            _updateTrackingVariables(
                account,
                relicId,
                shardId,
                blacklistedShardsCountCache == amount,
                equippedShardBalance == 0
            );
            unchecked {
                ++i;
            }
        }
        /// @dev burn from this contract. equipped shards are in contract
        shard.burnBatch(address(this), shardIds, amounts);
    }

    function _updateTrackingVariables(
        address account,
        uint256 relicId,
        uint256 shardId,
        bool blacklistedShardsCountCacheIsEqualAmount,
        bool equippedShardBalanceIsEqualZero
    ) internal {
        // update tracking variables
        if (blacklistedShardsCountCacheIsEqualAmount) {
            blacklistedAccounts[account] = false;
        }
        if (equippedShardBalanceIsEqualZero) {
            relicInfos[relicId].shards.remove(shardId);
        }
    }

    /// @notice before token transfer to avoid transferring blacklisted shards
    function _beforeTokenTransfers(
        address from,
        address to,
        uint256 startTokenId,
        uint256 /*quantity*/
    ) internal override {
        /// question should we allow blacklisted addresses to burn their relics?
        if (from != address(0) && blacklistedAccounts[from]) {
            revert CommonEventsAndErrors.AccountBlacklisted(from);
        }
        if (to != address(0) && blacklistedAccounts[to]) {
            revert CommonEventsAndErrors.AccountBlacklisted(to);
        }
        ownerRelics[from].remove(startTokenId);
        ownerRelics[to].add(startTokenId);
    }

    function getEquippedShardAmount(uint256 relicId, uint256 shardId) external view returns (uint256) {
        RelicInfo storage relicInfo = relicInfos[relicId];
        return relicInfo.equippedShards[shardId];
    }

    /*
     * @notice Get equipped Shard IDs in a Relic
     * @param relicId ID of relic
     * @return Array of shards equipped in Relic
     */
    function getEquippedShardIds(uint256 relicId) external override view returns (uint256[] memory) {
        if (!_exists(relicId)) { revert CommonEventsAndErrors.InvalidParam(); }
        return relicInfos[relicId].shards.values();
    }
    
    /*
     * @notice Get URI of rarity
     * @param rarity Rarity type
     * @return uri URI
     */
    function getRarityBaseUri(Rarity rarity) external view returns(string memory uri) {
        uri = baseUris[rarity];
    }

    /*
     * @notice Get Relic Info view
     * @param relicId Id of Relic
     * @return RelicInfoView
     */
    function getRelicInfo(uint256 relicId) external override view returns (RelicInfoView memory info) {
        RelicInfo storage relicInfo = relicInfos[relicId];
        info = RelicInfoView({
            enclaveId: relicInfo.enclaveId,
            rarity: relicInfo.rarity,
            xp: relicInfo.xp,
            shards: relicInfo.shards.values()
        });
    }

    function getNextTokenId() external view returns (uint256) {
        return _nextTokenId();
    }

    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * [EIP section](https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified)
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30000 gas.
     */
    function supportsInterface(bytes4 interfaceId) public pure override(ERC1155Receiver, IERC721A, IRelic) returns (bool) {
        // The interface IDs are constants representing the first 4 bytes
        // of the XOR of all function selectors in the interface.
        // See: [ERC165](https://eips.ethereum.org/EIPS/eip-165)
        // (e.g. `bytes4(i.functionA.selector ^ i.functionB.selector ^ ...)`)
        return
            interfaceId == 0x01ffc9a7 || // ERC165 interface ID for ERC165.
            interfaceId == 0x80ac58cd || // ERC165 interface ID for ERC721.
            interfaceId == 0x5b5e139f; // ERC165 interface ID for ERC721Metadata.
    }

    modifier onlyRelicOwner(uint256 relicId) {
        if (msg.sender != ownerOf(relicId)) { revert InvalidAccess(msg.sender); }
        _;
    }

    modifier notBlacklisted(address account) {
        if (blacklistedAccounts[account]) { revert CommonEventsAndErrors.AccountBlacklisted(account); }
        _;
    }

    modifier isRelicMinter() {
        if (!relicMinters[msg.sender]) { revert CallerCannotMint(msg.sender); }
        _;
    }

    modifier onlyOperator() {
        if (!operators[msg.sender]) { revert InvalidAccess(msg.sender); }
        _;
    }
}