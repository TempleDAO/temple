pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (nexus/Relic.sol)


import { ERC721ACustom } from "./ERC721ACustom.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { ERC1155Holder } from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import { ERC1155Receiver } from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Receiver.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC165 } from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import { IERC721A } from "../interfaces/nexus/IERC721A.sol";
import { CommonEventsAndErrors } from "../common/CommonEventsAndErrors.sol";
import { ElevatedAccess } from "./access/ElevatedAccess.sol";
import { IShard } from "../interfaces/nexus/IShard.sol";
import { IRelic } from "../interfaces/nexus/IRelic.sol";
import { INexusCommon } from "../interfaces/nexus/INexusCommon.sol";

/* @notice Relic Contract
 * Relic.sol is an ERC721A NFT contract with the functionality to receive and hold Shards.
 * Relics can be minted through a process called Temple Sacrifice, where a user sacrifices some TEMPLE tokens
 * to mint a Relic according to a price. More details about this price in nexus/TempleSacrifice.sol.
 * Relics NFTs are the the fundamental pieces of the Nexus world. Consider Relics as containers which can
 * be equipped with Shards and open mysterious doors. Relics have different rarity levels from common to rare to legendary.
 * A Relic's rarity changes as XP points are gained.
 */
contract Relic is IRelic, ERC721ACustom, ERC1155Holder, ElevatedAccess {
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
    mapping(Rarity => uint256) public override rarityXPThresholds;

    /// @notice to keep track of blacklisted relics and blacklisted shard balances
    mapping(uint256 => mapping(uint256 => uint256)) public override blacklistedRelicShards;
    mapping(address => bool) public override blacklistedAccounts;
    /// @notice count of shards blacklisted for Relic
    mapping(uint256 => uint256) public override blacklistedShardsCount;
    /// @notice some relic minting contracts may only mint special partner relic "enclave" Ids
    mapping(address => EnumerableSet.UintSet) private relicMinterEnclaveIds;
    mapping(address => EnumerableSet.UintSet) private ownerRelics;

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
        string memory name_,
        string memory symbol_,
        address _nexusCommon,
        address _initialExecutor
    ) ERC721ACustom(name_, symbol_) ElevatedAccess(_initialExecutor) {
        nexusCommon = INexusCommon(_nexusCommon);
    }

    /*
     * @notice Set shard contract
     * @param _shard Shard contract
     */
    function setShard(address _shard) external override onlyElevatedAccess {
        if (_shard == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        shard = IShard(_shard);
        emit ShardSet(address(shard));
    }

    /*
     * @notice Set Nexus Common contract
     * @param _contract Address of Nexus Common
     */
    function setNexusCommon(address _contract) external override onlyElevatedAccess {
        if (address(0) == _contract) { revert CommonEventsAndErrors.InvalidAddress(); }
        nexusCommon = INexusCommon(_contract);
        emit NexusCommonSet(_contract);
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
     * @notice Set relic minter's enclave Ids to mint
     * @param minter Address to mint relics
     * @param enclaveIds "enclave" Ids to mint. Could be a special non-enclave id.
     * @param allow If minter is allowed to mint enclave Id
     */
    function setRelicMinterEnclaveIds(address minter, uint256[] memory enclaveIds, bool[] memory allow) external override onlyElevatedAccess {
        if (minter == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        uint256 _length = enclaveIds.length;
        if (_length != allow.length) { revert InvalidParamLength(); }
        EnumerableSet.UintSet storage minterEnclaveIds = relicMinterEnclaveIds[minter];
        uint256 enclaveId;
        bool allowed;
        for (uint i; i < _length;) {
            allowed = allow[i];
            enclaveId = enclaveIds[i];
            if (allowed) {
                minterEnclaveIds.add(enclaveId);
            } else {
                minterEnclaveIds.remove(enclaveId);
            }
            emit RelicMinterEnclaveSet(minter, enclaveId, allowed);
            unchecked {
                ++i;
            }
        }
    }

    /*
     * @notice Set XP threshold for rarities
     * @param rarities Rarity array
     * @param thresholds Thresholds for XP
     */
    function setXPRarityThresholds(
        Rarity[] calldata rarities,
        uint256[] calldata thresholds
    ) external override onlyElevatedAccess {
        uint256 _length = rarities.length;
        if (_length != thresholds.length) { revert InvalidParamLength(); }
        for(uint i; i < _length;) {
            uint256 _threshold = thresholds[i];
            Rarity _rarity = rarities[i];
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
    function setBaseUriRarity(Rarity rarity, string memory _uri) external override onlyElevatedAccess {
        if (bytes(_uri).length == 0 ) { revert CommonEventsAndErrors.InvalidParam(); }
        baseUris[rarity] = _uri;
        emit RarityBaseUriSet(rarity, _uri);
    }
 
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
    ) external override onlyElevatedAccess {
        _validateBlacklisting(account, relicId);
        if (blacklist) {
            blacklistedAccounts[account] = true;
        } else {
            if (blacklistedShardsCount[relicId] > 0) { revert CannotWhitelist(relicId); }
            blacklistedAccounts[account] = false;
        }
        emit AccountBlacklisted(account, blacklist);
    }

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
    ) external override onlyElevatedAccess {
        _validateBlacklisting(account, relicId);
        uint256 _length = shardIds.length;
        if (_length != amounts.length) { revert InvalidParamLength(); }
        uint256 shardId;
        uint256 amount;
        /// @dev only valid in storage because it contains a (nested) mapping.
        mapping(uint256 => uint256) storage equippedShards = relicInfos[relicId].equippedShards;
        uint256 shardsCount;
        uint256 blacklistedRelicBalance;
        /// cache for gas savings
        mapping(uint256 => uint256) storage blacklistedRelic = blacklistedRelicShards[relicId];
        for(uint i; i < _length;) {
            shardId = shardIds[i];
            amount = amounts[i];
            /// blacklist only equipped shards
            blacklistedRelicBalance = blacklistedRelic[shardId] + amount;
            /// @dev checks that we don't blacklist more than equipped. condition holds if shardIds are duplicated in calldata
            if (equippedShards[shardId] < blacklistedRelicBalance) {
                revert NotEnoughShardBalance(equippedShards[shardId], blacklistedRelicBalance);
            }
            blacklistedRelic[shardId] = blacklistedRelicBalance;
            emit ShardBlacklistUpdated(relicId, shardId, amount);
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
    ) external override onlyElevatedAccess {
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
            emit ShardBlacklistUpdated(relicId, shardId, amount);
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
    
    /*
     * @notice Set XP for a relic
     * @param relicId ID of relic
     * @param xp XP to set
     */
    function setRelicXP(uint256 relicId, uint256 xp) external override onlyElevatedAccess {
        if(!_exists(relicId)) { revert InvalidRelic(relicId); }
        RelicInfo storage relicInfo = relicInfos[relicId];
        // leave open for when xp could increase or decrease
        relicInfo.xp = uint128(xp);
        emit RelicXPSet(relicId, xp);
        _checkpointRelicRarity(relicInfo, xp);
    }

    /*
     * @notice Checkpoint the rarity of a relic. This function is open to external calls.
     * @param relicId ID of relic
     */
    function checkpointRelicRarity(uint256 relicId) external override {
        if(!_exists(relicId)) { revert InvalidRelic(relicId); }
        RelicInfo storage relicInfo = relicInfos[relicId];
        _checkpointRelicRarity(relicInfo, relicInfo.xp);
    }

    function _checkpointRelicRarity(RelicInfo storage relicInfo, uint256 xp) internal {
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
    function relicsOfOwner(address owner) external view override returns (uint256[] memory _ownerRelics) {
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
    ) external override view returns(uint256[] memory balances) {
        if(!_exists(relicId)) { revert InvalidRelic(relicId); }
        uint256 _length = shardIds.length;
        balances = new uint256[](_length);
        /// only valid in storage because it contains nested mapping
        RelicInfo storage relicInfo = relicInfos[relicId];
        for (uint i; i < _length;) {
            balances[i] = relicInfo.equippedShards[shardIds[i]];
            unchecked {
                ++i;
            }
        }
    }

    /*
     * @notice Mint Relic. Function checks if recipient address is blacklisted
     * @param to Address of recipient
     * @param enclave Enclave type
     */
    function mintRelic(
        address to,
        uint256 enclaveId
    ) external override notBlacklisted(to) returns (uint256 tokenId) {
        if (to == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        if (!nexusCommon.isValidEnclaveId(enclaveId)) { revert CommonEventsAndErrors.InvalidParam(); }
        if (!isRelicMinter(msg.sender, enclaveId)) { revert CallerCannotMint(msg.sender); }

        tokenId = _nextTokenId();
        RelicInfo storage relicInfo = relicInfos[tokenId];
        relicInfo.enclaveId = enclaveId;
        // relicInfo.rarity = Rarity.Common;
        // relicInfo.xp = uint128(0);
        
        ownerRelics[to].add(tokenId);
        /// keeping another event because of extra details in RelicMinted event
        emit RelicMinted(to, tokenId, enclaveId);
        /// user can mint relic anytime after sacrificing some sacrifice tokens and getting whitelisted. one at a time
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
    ) external override onlyRelicOwner(relicId) notBlacklisted(msg.sender) {
        uint256 _length = shardIds.length;
        if (_length != amounts.length) { revert InvalidParamLength(); }
        // using batch transfer as validation msg.sender owns all shards
        shard.safeBatchTransferFrom(msg.sender, address(this), shardIds, amounts, ZERO_BYTES);
        RelicInfo storage relicInfo = relicInfos[relicId];
        uint256 shardId; 
        uint256 amount;
        for (uint i; i < _length;) {
            shardId = shardIds[i];
            amount = amounts[i];
            relicInfo.equippedShards[shardId] += amount;
            /// @dev amounts[i] could be 0
            if (amount > 0) {
                relicInfo.shards.add(shardId);
            }
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
    ) external override onlyRelicOwner(relicId) notBlacklisted(msg.sender) {
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
            /// update Shards set
            if (equippedAmountCache == amount) {
                relicInfo.shards.remove(shardId);
            }
            unchecked {
                relicInfo.equippedShards[shardId] = equippedAmountCache - amount;
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
    function totalMinted() external override view returns (uint256) {
        return _totalMinted();
    }

    /*
     * @notice Get next token Id
     * @return uint256 Next token Id
     */
    function nextTokenId() external override view returns (uint256) {
        return _nextTokenId();
    }

    /*
     * @notice Recover tokem sent to contract by error
     * @param token Address of token
     * @param to Recipient of token amount
     * @return amount Amount of token to recover
     */
    function recoverToken(address token, address to, uint256 amount) external override onlyElevatedAccess {
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
    ) external override onlyElevatedAccess {
        // account could be whitelisted or blacklisted. important check is account's Relic shards are blacklisted
        _validateBlacklisting(account, relicId);
        uint256 _length = shardIds.length;
        if (_length != amounts.length) { revert InvalidParamLength(); }
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
            equippedShards[shardId] = equippedShardBalance;
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

    /// @notice before token transfer to avoid transferring blacklisted shards
    function _beforeTokenTransfers(
        address from,
        address to,
        uint256 startTokenId,
        uint256 /*quantity*/
    ) internal override {
        if (from != address(0) && blacklistedAccounts[from]) {
            revert CommonEventsAndErrors.AccountBlacklisted(from);
        }
        if (to != address(0) && blacklistedAccounts[to]) {
            revert CommonEventsAndErrors.AccountBlacklisted(to);
        }
        // DAO/admin should handle Relic's blacklisted shards explicitly
        /// @dev it is impossible to unset blacklist for an account with blacklisted shards > 0
        // if (blacklistedShardsCount[startTokenId] > 0) {
        //     revert RelicWithBlacklistedShards();
        // }
        ownerRelics[from].remove(startTokenId);
        ownerRelics[to].add(startTokenId);
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
     * @notice Get Relic minter enclave Ids
     * @param minter Address to check
     * @return Enclave Ids
     */
    function getRelicMinterEnclaveIds(address minter) external override view returns (uint256[] memory) {
        return relicMinterEnclaveIds[minter].values();
    }
    
    /*
     * @notice Get URI of rarity
     * @param rarity Rarity type
     * @return uri URI
     */
    function getRarityBaseUri(Rarity rarity) external override view returns(string memory uri) {
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

    /*
     * @notice Get status of address minting Relic with enclaveId
     * @param minter Address of mitner
     * @param enclaveId Id of enclave
     * @return True or False
     */
    function isRelicMinter(address minter, uint256 enclaveId) public override view returns (bool) {
        return relicMinterEnclaveIds[minter].contains(enclaveId);
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
        if (msg.sender != ownerOf(relicId)) { revert CommonEventsAndErrors.InvalidAccess(); }
        _;
    }

    modifier notBlacklisted(address account) {
        if (blacklistedAccounts[account]) { revert CommonEventsAndErrors.AccountBlacklisted(account); }
        _;
    }
}