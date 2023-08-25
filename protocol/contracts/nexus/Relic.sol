pragma solidity 0.8.18;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (nexus/Relic.sol)


import { ERC721ACustom } from "./ERC721ACustom.sol";
// import { ERC1155Holder } from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import { ERC1155Receiver } from "./ERC1155Receiver.sol";
import { IERC1155Receiver } from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC165 } from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { IERC721A } from "../interfaces/nexus/IERC721A.sol";
import { CommonEventsAndErrors } from "../common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "../v2/access/TempleElevatedAccess.sol";
import { IShard } from "../interfaces/nexus/IShard.sol";

contract Relic is ERC721ACustom, ERC1155Receiver, TempleElevatedAccess {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    IShard public shard;

    /// @dev leaving rarity open for updates
    mapping(uint256 => string) public rarityUris;

    enum Rarity {
        Common,
        Uncommon,
        Rare,
        Epic,
        Legendary
    }

    uint256 private constant RARITIES_COUNT = 0x05;
    uint256 private constant ENCLAVES_COUNT = 0x05;
    address private constant ZERO_ADDRESS = 0x0000000000000000000000000000000000000000;
    uint256 private constant PER_MINT_QUANTITY = 0x01;
    bytes private constant ZERO_BYTES = "";

    enum Enclave {
        Chaos,
        Mystery,
        Logic,
        Order,
        Structure
    }

    struct RelicInfo {
        Enclave enclave;
        Rarity rarity;
        uint128 xp;
        /// @notice shards equipped to this contract. can extract owner of relic from ownerOf(relicId)
        mapping(uint256 => uint256) equippedShards;
    }
    /// @notice mapping for information about relic. relicId to RelicInfo
    mapping(uint256 => RelicInfo) public relicInfos;

    /// @notice base uris for different rarities
    mapping(Rarity => string) private baseUris;

    /// @notice XP thresholds for Relic rarity levels
    mapping(Rarity => uint256) public rarityXPThresholds;

    /// @notice callers who can update xp info for a relic
    mapping(address => bool) public xpControllers;

    /// @notice to keep track of blacklisted accounts and shard balances
    mapping(address => mapping(uint256 => uint256)) public blacklistedAccountShards;
    mapping(address => bool) public blacklistedAccounts;
    mapping(address => bool) public relicMinters;
    mapping(address => EnumerableSet.UintSet) private ownerRelics;

    event RarityXPThresholdSet(Rarity rarity, uint256 threshold);
    event RarityBaseUriSet(Rarity rarity, string uri);
    event RelicMinterSet(address minter, bool allow);
    event ShardSet(address shard);
    event RelicMinted(address to, uint256 nextTokenId, uint256 quantity);
    event XPControllerSet(address controller, bool flag);
    event RelicXPSet(uint256 relicId, uint256 oldXp, uint256 xp);
    event ShardEquipped(address caller, uint256 relicId, uint256 shardId, uint256 amount);
    event ShardsEquipped(address caller, uint256 relicId, uint256[] shardIds, uint256[] amounts);
    event ShardUnequipped(address caller, uint256 relicId, uint256 shardId, uint256 amount);
    event ShardsUnequipped(address recipient, uint256 relicId, uint256[] shardIds, uint256[] amounts);
    event AccountBlacklistSet(address account, bool blacklist, uint256[] shardIds, uint256[] amounts);

    error InvalidParamLength();
    error CallerCannotMint(address msgSender);
    error InvalidRelic(uint256 relicId);
    error InvalidAddress(address invalidAddress);
    error InvalidAccess(address account);
    error FunctionNotEnabled();
    error InsufficientShardBalance(uint256 actualBalance, uint256 requestedBalance);
    error ZeroAddress();
    error AccountBlacklisted(address account);
    error InvalidOwner(address invalidOwner);

    constructor(
        string memory _name,
        string memory _symbol,
        address initialRescuer,
        address initialExecutor
    ) ERC721ACustom(_name, _symbol) TempleElevatedAccess(initialRescuer, initialExecutor) {}

    function setShard(address _shard) external onlyElevatedAccess {
        if (_shard == ZERO_ADDRESS) { revert InvalidAddress(ZERO_ADDRESS); }
        shard = IShard(_shard);
        emit ShardSet(address(shard));
    }

    function _baseURI(uint256 relicId) internal view override returns (string memory uri) {
        /// get uri using relicId rarity
        RelicInfo storage relicInfo = relicInfos[relicId];
        uri = baseUris[relicInfo.rarity];
    }

    function setXPRarityThreshold(Rarity rarity, uint256 threshold) external onlyElevatedAccess {
        if (!isAllowedRarity(rarity)) { revert CommonEventsAndErrors.InvalidParam(); }
        if (threshold != rarityXPThresholds[rarity]) {
            rarityXPThresholds[rarity] = threshold;
            emit RarityXPThresholdSet(rarity, threshold);
        }
    }

    function setRelicMinter(address minter, bool allow) external onlyElevatedAccess {
        if (minter == ZERO_ADDRESS) { revert ZeroAddress(); }
        relicMinters[minter] = allow;
        emit RelicMinterSet(minter, allow);
    }

    function setXPController(address controller, bool flag) external onlyElevatedAccess {
        if (controller == ZERO_ADDRESS) { revert ZeroAddress(); }
        xpControllers[controller] = flag;
        emit XPControllerSet(controller, flag);
    }

    function setXPRarityThresholds(
        Rarity[] calldata rarities,
        uint256[] calldata thresholds
    ) external onlyElevatedAccess {
        uint256 _length = rarities.length;
        if (_length != thresholds.length) { revert InvalidParamLength(); }
        for(uint i; i < _length;) {
            uint256 _threshold = thresholds[i];
            Rarity _rarity = rarities[i];
            if (!isAllowedRarity(_rarity)) { revert CommonEventsAndErrors.InvalidParam(); }
            if (_threshold != rarityXPThresholds[_rarity]) {
                rarityXPThresholds[_rarity] = _threshold;
                emit RarityXPThresholdSet(_rarity, _threshold);
            }
            unchecked {
                ++i;
            }
        }
    }

    function setBaseUriRarity(Rarity rarity, string memory uri) external onlyElevatedAccess {
        baseUris[rarity] = uri;
        emit RarityBaseUriSet(rarity, uri);
    }

    /// @notice blacklist an account with or without shards. 
    /* If no shards are given, the account will only be blacklisted from
     * minting new relics
     * if flag is true, blacklist will set account and shards to true. Else, false.
     */
    function setBlacklistAccount(
        address account,
        bool blacklist,
        uint256[] memory shardIds,
        uint256[] memory amounts
    ) external onlyElevatedAccess {
        if (account == ZERO_ADDRESS) { revert ZeroAddress(); }
        uint256 _length = shardIds.length;
        if (_length != amounts.length) { revert InvalidParamLength(); }
        blacklistedAccounts[account] = blacklist;
        uint256 shardId;
        uint256 amount;
        /// pending to unset blacklist. if true, account will be removed from blacklist
        bool pending = false;
        for(uint i; i < _length;) {
            shardId = shardIds[i];
            amount = amounts[i];
            // for blacklisting
            if (blacklist) {
                blacklistedAccountShards[account][shardId] = amount;
            } else { // removing from blacklist
                if (amount >= blacklistedAccountShards[account][shardId]) {
                    blacklistedAccountShards[account][shardId] = 0;
                } else {
                    blacklistedAccountShards[account][shardId] -= amount;
                    pending = true;
                }
            }
            unchecked {
                ++i;
            }
        }
        if (pending) {
            blacklistedAccounts[account] = true;
        }
        emit AccountBlacklistSet(account, blacklist, shardIds, amounts);
    }

    function setRelicXP(uint256 relicId, uint256 xp) external onlyXPController {
        if(!_exists(relicId)) { revert InvalidRelic(relicId); }
        RelicInfo storage relicInfo = relicInfos[relicId];
        /// @notice cache to save gas
        uint256 oldXp = relicInfo.xp;
        if (oldXp >= xp) { revert CommonEventsAndErrors.InvalidParam(); }
        relicInfo.xp = uint128(xp);
        emit RelicXPSet(relicId, oldXp, xp);
    }

    /// @notice DAO may vote to burn shards from blacklisted accounts
    function burnShards(uint256[] memory shardIds, uint256[] memory amounts) external onlyElevatedAccess {
        /// @notice DAO may decide to burn shards from blacklisted accounts
        /// @dev burnBatch will check if shard is owned by caller(this address)
        shard.burnBatch(address(this), shardIds, amounts);
    }

    function relicsOfOwner(address _owner) external view returns (uint256[] memory _ownerRelics) {
        return ownerRelics[_owner].values();
    }

    function getBalanceBatch(
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

    function getBaseUriRarity(Rarity rarity) external view returns (string memory uri) {
        uri = baseUris[rarity];
    }

    function mintRelic(address to, Enclave enclave) external isRelicMinter notBlacklisted(to) {
        if (to == ZERO_ADDRESS) { revert ZeroAddress(); }
        if (!isAllowedEnclave(enclave)) { revert CommonEventsAndErrors.InvalidParam(); }

        uint256 nextTokenId = _nextTokenId();
        RelicInfo storage relicInfo = relicInfos[nextTokenId];
        relicInfo.enclave = enclave;
        relicInfo.rarity = Rarity.Common;
        relicInfo.xp = uint128(0);
        
        ownerRelics[to].add(nextTokenId);
        /// user can mint relic anytime after sacrificing temple and getting whitelisted. one at a time
        _safeMint(to, PER_MINT_QUANTITY, ZERO_BYTES);
        emit RelicMinted(to, nextTokenId, PER_MINT_QUANTITY);
    }

    function equipShard(
        uint256 relicId,
        uint256 shardId,
        uint256 amount
    ) external onlyRelicOwner(relicId) notBlacklisted(msg.sender) {
        if (amount == 0) { revert CommonEventsAndErrors.InvalidParam(); }
        shard.safeTransferFrom(msg.sender, address(this), shardId, amount, "");
 
        RelicInfo storage relicInfo = relicInfos[relicId];
        relicInfo.equippedShards[shardId] += amount;

        emit ShardEquipped(msg.sender, relicId, shardId, amount);
    }

    function batchEquipShards(
        uint256 relicId,
        uint256[] memory shardIds,
        uint256[] memory amounts
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

    function unequipShard(
        uint256 relicId,
        uint256 shardId,
        uint256 amount
    ) external onlyRelicOwner(relicId) notBlacklisted(msg.sender) {
        if (amount == 0) { revert CommonEventsAndErrors.InvalidParam(); }
        RelicInfo storage relicInfo = relicInfos[relicId];
        uint256 equippedAmountCache = relicInfo.equippedShards[shardId];
        if (equippedAmountCache < amount) { 
            revert InsufficientShardBalance(equippedAmountCache, amount); 
        }
        unchecked {
            relicInfo.equippedShards[shardId] -= amount;
        }
        shard.safeTransferFrom(address(this), msg.sender, shardId, amount, ZERO_BYTES);

        emit ShardUnequipped(msg.sender, relicId, shardId, amount);
    }

    function batchUnequipShards(
        uint256 relicId,
        uint256[] memory shardIds,
        uint256[] memory amounts
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

    function totalMinted() external view returns (uint256) {
        return _totalMinted();
    }

    function recoverToken(address token, address to, uint256 amount) external onlyElevatedAccess {
        if (to == address(0)) revert InvalidAddress(to);
        IERC20(token).safeTransfer(to, amount);
        emit CommonEventsAndErrors.TokenRecovered(to, token, amount);
    }

    function recoverNFT(IERC721A nft, address to, uint256 tokenId) external onlyElevatedAccess {
        if (address(nft) == address(this)) { revert CommonEventsAndErrors.InvalidParam(); }
        if (address(nft) == address(shard)) { revert CommonEventsAndErrors.InvalidParam(); }
        address owner = ownerOf(tokenId);
        if (owner != address(this)) { revert InvalidOwner(owner); }
        if (to == ZERO_ADDRESS) { revert ZeroAddress(); }
        nft.safeTransferFrom(address(this), to, tokenId);
    }

    function burnBlacklistedAccountShards(
        address account,
        bool whitelistAfterBurn,
        uint256[] memory shardIds
    ) external onlyElevatedAccess {
        if (!blacklistedAccounts[account]) { revert CommonEventsAndErrors.InvalidParam(); }
        uint256 _length = shardIds.length;
        uint256[] memory amounts;
        uint256 shardId;
        for(uint i; i < _length;) {
            shardId = shardIds[i];
            amounts[i] = blacklistedAccountShards[account][shardId];
            // delete only for argument shards
            delete blacklistedAccountShards[account][shardId];
            unchecked {
                ++i;
            }
        }
        shard.burnBatch(account, shardIds, amounts);
        if (whitelistAfterBurn) {
            delete blacklistedAccounts[account];
        }
    }

    /// @notice before token transfer to avoid transferring blacklisted shards
    // question, what if shards are equipped in this relic bag already
    function _beforeTokenTransfers(
        address from,
        address to,
        uint256 startTokenId,
        uint256 /*quantity*/
    ) internal override {
        /// question should we allow blacklisted addresses to burn their relics?
        if (from != ZERO_ADDRESS && blacklistedAccounts[from]) {
            revert AccountBlacklisted(from);
        }
        if (to != ZERO_ADDRESS && blacklistedAccounts[to]) {
            revert AccountBlacklisted(to);
        }
        ownerRelics[from].remove(startTokenId);
        ownerRelics[to].add(startTokenId);
    }

    function isAllowedEnclave(Enclave enclave) private pure returns (bool) {
        if (uint256(enclave) > ENCLAVES_COUNT-1) {
            return false;
        }
        return true;
    }

    function isAllowedRarity(Rarity rarity) private pure returns (bool) {
        if (uint256(rarity) > RARITIES_COUNT-1) {
            return false;
        }
        return true;
    }

    function getRarityBaseUri(Rarity rarity) external view returns(string memory uri) {
        uri = baseUris[rarity];
    }

    // function supportsInterface(bytes4 interfaceId) public view override(ERC1155Holder) returns (bool) {
    //     return interfaceId == type(IERC1155Receiver).interfaceId || super.supportsInterface(interfaceId);
    // }
     /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * [EIP section](https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified)
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30000 gas.
     */
    function supportsInterface(bytes4 interfaceId) public view override(ERC165, IERC165, IERC721A) returns (bool) {
        // The interface IDs are constants representing the first 4 bytes
        // of the XOR of all function selectors in the interface.
        // See: [ERC165](https://eips.ethereum.org/EIPS/eip-165)
        // (e.g. `bytes4(i.functionA.selector ^ i.functionB.selector ^ ...)`)
        return
            interfaceId == 0x01ffc9a7 || // ERC165 interface ID for ERC165.
            interfaceId == 0x80ac58cd || // ERC165 interface ID for ERC721.
            interfaceId == 0x5b5e139f; // ERC165 interface ID for ERC721Metadata.
    }

    modifier onlyXPController() {
        if (!xpControllers[msg.sender]) { revert InvalidAccess(msg.sender); }
        _;
    }

    modifier onlyRelicOwner(uint256 relicId) {
        if (msg.sender != ownerOf(relicId)) { revert InvalidAccess(msg.sender); }
        _;
    }

    modifier notBlacklisted(address account) {
        if (blacklistedAccounts[account]) { revert AccountBlacklisted(account); }
        _;
    }

    modifier isRelicMinter() {
        if (!relicMinters[msg.sender]) { revert CallerCannotMint(msg.sender); }
        _;
    }
}
