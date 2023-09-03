pragma solidity 0.8.18;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (nexus/Shard.sol)

import { IRelic } from "../interfaces/nexus/IRelic.sol";
import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { ERC1155Burnable } from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { TempleElevatedAccess } from "../v2/access/TempleElevatedAccess.sol";
import { CommonEventsAndErrors } from "../common/CommonEventsAndErrors.sol";

contract Shard is ERC1155, ERC1155Burnable, TempleElevatedAccess {
    using EnumerableSet for EnumerableSet.UintSet;

    IRelic public relic;
    address private constant ZERO_ADDRESS = 0x0000000000000000000000000000000000000000;

    /// @notice all 3 mappings below not combined into a struct for reasons allowedPartnerShardIds read often than rest. 
    /* also for easy public reads(read functions). avoids cycle error
     * choosing mapping of address to EnumerableSet to help supporting view functions like getPartnerMintInfo
     */
    mapping(address => EnumerableSet.UintSet) private allowedPartnerShardIds;
    mapping(address => mapping(uint256 => uint256)) public allowedPartnersShardCaps;
    mapping(address => mapping(uint256 => uint256)) public partnerMintBalances;
    /// @notice keep track of all shards reserved for partners. helps to guard general mints also
    EnumerableSet.UintSet private partnerShards;

    /// @notice shard ids to uris
    mapping(uint256 => string) public shardUris;

    /// @notice minters who can mint for templars
    mapping(address => bool) public templarMinters;

    mapping(uint256 => Recipe) private recipes;

    /// @notice for compact view functions
    struct PartnerMintInfo {
        uint256[] shardIds;
        uint256[] caps;
        uint256[] balances;
    }

    /// @dev maintaining uint256[] to avoid casting in batch functions like burnBatch
    struct Recipe {
        uint256[] inputShardIds;
        uint256[] inputShardAmounts;
        uint256[] outputShardIds;
        uint256[] outputShardAmounts;
    }

    event Transmuted(address caller, uint256 recipeId);
    event ShardMinted();
    event ShardUriSet(uint256 shardId, string uri);
    event RecipeSet(uint256 recipeId, Recipe recipe);
    event PartnerAllowedShardIdSet(address partner, uint256 shardId, bool allow);
    event PartnerAllowedShardIdsSet(address partner, uint256[] shardIds, bool[] allowances);
    event PartnerAllowedShardCapsSet(address partner, uint256[] shardIds, uint256[] caps);
    event TemplarMinterSet(address minter, bool allowed);
    event RecipeDeleted(uint256 recipeId);

    error ReservedPartnerShard(uint256 shardId);
    error ShardMintNotAllowed(address caller, uint256 shardId);
    error CannotTransmute(address caller);
    error CannotMint(address caller);
    error MintCapExceeded(uint256 cap, uint256 amount);
    error InvalidRecipe(uint256 recipeId);
    error ZeroAddress();
    error PartnerAllowShardFailed(address partner, uint256 shardId, bool allowed);
    error InvalidParamLength();
    error InvalidAccess(address caller);
    error InvalidCaller(address caller);
    error ERC1155MissingApprovalForAll(address msgSender, address account);
    error AccountBlacklisted(address account);


    constructor(
        address _relic,
        address _initialRescuer,
        address _initialExecutor,
        string memory _uri
    ) ERC1155(_uri) TempleElevatedAccess(_initialRescuer, _initialExecutor) {
        relic = IRelic(_relic);
    }

    function setTemplarMinter(address minter, bool allowed) external onlyElevatedAccess {
        if (minter == ZERO_ADDRESS) { revert ZeroAddress(); }
        templarMinters[minter] = allowed;
        emit TemplarMinterSet(minter, allowed);
    }

    /// @notice shardId should not have been minted, nextId =< shardId 
    function setPartnerAllowedShardId(address partner, uint256 shardId, bool allow) external onlyElevatedAccess {
        /// @notice admin should check shardId does not exist
        if (partner == ZERO_ADDRESS) { revert ZeroAddress(); }
        bool success;
        if (allow) {
            success = allowedPartnerShardIds[partner].add(shardId);
            if (!success) { revert PartnerAllowShardFailed(partner, shardId, allow); }
            partnerShards.add(shardId);
        } else {
            success = allowedPartnerShardIds[partner].remove(shardId);
            if (!success) { revert PartnerAllowShardFailed(partner, shardId, allow); }
            partnerShards.remove(shardId);
        }
        emit PartnerAllowedShardIdSet(partner, shardId, allow);
    }

    function setPartnerAllowedShardIds(
        address partner,
        uint256[] memory shardIds,
        bool[] memory flags
    ) external onlyElevatedAccess {
         if (partner == ZERO_ADDRESS) { revert ZeroAddress(); }
         uint256 _length = shardIds.length;
         bool allowed;
         uint256 shardId;
         if (_length != flags.length) { revert InvalidParamLength(); }
         for (uint i; i < _length;) {
            allowed = flags[i];
            shardId = shardIds[i];

            EnumerableSet.UintSet storage partnerShardIds = allowedPartnerShardIds[partner];
            if (allowed && !partnerShardIds.contains(shardId)) {
                /// @dev ignoring return values if add failed so that we don't revert in the iteration. to allow completion
                /* success = */ partnerShardIds.add(shardId);
                //if (!success) { revert PartnerAllowShardFailed(partner, shardId, allowed); }
                // also keep track of all partner shards, for convenience guard checks when user mints
                if (!partnerShards.contains(shardId)) {
                    partnerShards.add(shardId);
                }
            } else if (!allowed && partnerShardIds.contains(shardId)){
                /* success = */ partnerShardIds.remove(shardId);
                // if (!success) { revert PartnerAllowShardFailed(partner, shardId, allowed); }
                if (partnerShards.contains(shardId)) {
                    partnerShards.remove(shardId);
                }
            }
            unchecked {
                 ++i;
             }
         }
         emit PartnerAllowedShardIdsSet(partner, shardIds, flags);
    }

    /// @notice set the caps for shards partners can mint
    function setPartnerAllowedShardCaps(
        address partner,
        uint256[] memory shardIds,
        uint256[] memory caps
    ) external onlyElevatedAccess {
        /// @notice 0 by default which is unlimited
        if (partner == ZERO_ADDRESS) { revert ZeroAddress(); }
        uint256 _length = shardIds.length;
        if (_length != caps.length) { revert InvalidParamLength(); }
        for (uint i; i < _length; ) {
            allowedPartnersShardCaps[partner][shardIds[i]] = caps[i];
            unchecked {
                ++i;
            }
        }
        emit PartnerAllowedShardCapsSet(partner, shardIds, caps);
    }

    /// @notice Set a recipe for transmutation
    function setRecipe(uint256 recipeId, Recipe calldata recipe) external onlyElevatedAccess {
        uint256 _inputLength = recipe.inputShardIds.length;
        if (_inputLength != recipe.inputShardAmounts.length) { revert CommonEventsAndErrors.InvalidParam(); }
        uint256 _outputLength = recipe.outputShardAmounts.length;
        if (_outputLength != recipe.outputShardIds.length) { revert CommonEventsAndErrors.InvalidParam(); }

        recipes[recipeId] = recipe;
        emit RecipeSet(recipeId, recipe);
    }

    function deleteRecipe(uint256 recipeId) external onlyElevatedAccess {
        Recipe storage recipe = recipes[recipeId];
        if (recipe.inputShardIds.length == 0) { revert CommonEventsAndErrors.InvalidParam(); }
        delete recipes[recipeId];
        emit RecipeDeleted(recipeId);
    }

    function setShardUri(uint256 shardId, string memory uri) external onlyElevatedAccess {
        if (bytes(uri).length == 0 ) { revert CommonEventsAndErrors.InvalidParam(); }
        shardUris[shardId] = uri;
        emit ShardUriSet(shardId, uri);
    }

    function uri(uint256 shardId) public view override returns (string memory) {
        return shardUris[shardId];
    }

    function transmute(uint256 recipeId) external {
        address caller = msg.sender;
        Recipe memory recipe = recipes[recipeId];
        if (recipe.inputShardIds.length == 0) { revert InvalidRecipe(recipeId); }
        /// @dev function checks caller has enough balances
        _burnBatch(caller, recipe.inputShardIds, recipe.inputShardAmounts);
        _mintBatch(caller, recipe.outputShardIds, recipe.outputShardAmounts, "");

        emit Transmuted(caller, recipeId);
    }

    function partnerMint(address to, uint256 shardId, uint256 amount) external isNotBlacklisted(to) {
        if (!allowedPartnerShardIds[msg.sender].contains(shardId)) { revert ShardMintNotAllowed(msg.sender, shardId); }
        // default 0 value means uncapped
        uint256 cap = allowedPartnersShardCaps[msg.sender][shardId];
        // check partner balances
        uint256 newBalance = partnerMintBalances[msg.sender][shardId] + amount;
        if (cap > 0 && newBalance > cap) {
            revert MintCapExceeded(cap, newBalance);
        }
        partnerMintBalances[msg.sender][shardId] = newBalance;
        /// @notice not duplicating variable for tracking partner mint because only partner can mint to given addresses
        _mint(to, shardId, amount, "");
        /// @dev track event with TransferSingle
    }

    /// @notice Lets an approved partner mint shards in batch
    function partnerBatchMint(
        address to,
        uint256[] memory shardIds,
        uint256[] memory amounts
    ) external isNotBlacklisted(to) {
        uint256 _length = shardIds.length;
        if (_length != amounts.length) { revert InvalidParamLength(); }
        uint256 cap;
        uint256 shardId;
        uint256 amount;
        EnumerableSet.UintSet storage allowedPartnerShards = allowedPartnerShardIds[msg.sender];
        mapping(uint256 => uint256) storage _allowedPartnerShardCaps = allowedPartnersShardCaps[msg.sender];
        uint256 newBalance;
        for (uint i; i < _length;) {
            shardId = shardIds[i];
            if (!allowedPartnerShards.contains(shardId)) { revert ShardMintNotAllowed(msg.sender, shardId); }
            amount = amounts[i];
            cap = _allowedPartnerShardCaps[shardId];
            newBalance =  partnerMintBalances[msg.sender][shardId] + amount;
            /// @dev checking only if cap set. 0 (default value) is uncapped
            if (cap > 0 && cap < newBalance) {
                revert MintCapExceeded(cap, amount);
            }
            partnerMintBalances[msg.sender][shardId] = newBalance;
            unchecked {
                ++i;
            }
        }
        _mintBatch(to, shardIds, amounts, "");
    }

    function mint(
        address to,
        uint256 shardId,
        uint256 amount
    ) external onlyTemplarMinters isNotBlacklisted(to) {
        if(partnerShards.contains(shardId))  { revert ReservedPartnerShard(shardId); }
        /// @dev fail early
        if (amount == 0) { revert CommonEventsAndErrors.InvalidParam(); }
        _mint(to, shardId, amount, "");
    }

    function mintBatch(
        address to,
        uint256[] memory shardIds,
        uint256[] memory amounts
    ) external onlyTemplarMinters isNotBlacklisted(to) {
        uint256 _length = shardIds.length;
        if (_length != amounts.length) { revert InvalidParamLength(); }
        // validate shards
        uint256 shardId;
        for (uint i; i < _length;) {
            shardId = shardIds[i];
            if(partnerShards.contains(shardId))  { revert ReservedPartnerShard(shardId); }
            unchecked {
                ++i;
            }
        }
        _mintBatch(to, shardIds, amounts, "");
    }

    function burnBatch(address account, uint256[] memory ids, uint256[] memory values) public override {
        // allow relic to burn blacklisted relic shards
        if (_msgSender() == address(relic)) {
            _burnBatch(account, ids, values);
            return;
        } else if (account != _msgSender() && !isApprovedForAll(account, _msgSender())) {
            revert ERC1155MissingApprovalForAll(_msgSender(), account);
        }
        _burnBatch(account, ids, values);
    }

    /// @notice if we ever go back to the token type ID substitution mechanism
    // function setURI(string memory uri) external onlyOperator {
    //     _setURI(uri);
    // }

    // function uriLegacy() external view returns (string memory) {
    //     return uri();
    // }

    function getPartnerAllowedShardIds(address partner) external view returns (uint256[] memory) {
        return allowedPartnerShardIds[partner].values();
    }

    function getAllPartnerShardIds() external view returns (uint256[] memory) {
        return partnerShards.values();
    }

    function getRecipeInfo(uint256 recipeId) external view returns (Recipe memory info) {
        info = recipes[recipeId];
    }

    function isPartnerShard(uint256 shardId) external view returns (bool) {
        return partnerShards.contains(shardId);
    }

    /// @notice not validating partner and reverting. caller should check and handle zero values
    function getPartnerMintsInfo(address partner) external view returns (PartnerMintInfo memory info) {
        EnumerableSet.UintSet storage partnerShardIds = allowedPartnerShardIds[partner];
        /// workaround: storage pointer is not implicitly convertible to expected type uint256[] memory
        /// also have to cast enumerable set to uint256[] to be able to return. 
        /// Types containing (nested) mappings can only be parameters or return variables of internal or library functions
        uint256 _length = partnerShardIds.length();
        info.shardIds = new uint256[](_length);
        info.balances = new uint256[](_length);
        info.caps = new uint256[](_length);
        uint256 shardId;
        /// @dev indices don't start at 0
        for (uint i = 1; i < _length;) {
            shardId = partnerShardIds.at(i);
            info.shardIds[i-1] = shardId;
            info.balances[i-1] = partnerMintBalances[partner][shardId];
            info.caps[i-1] = allowedPartnersShardCaps[partner][i-1];
            unchecked {
                ++i;
            }
        }
    }

    modifier isNotBlacklisted(address to) {
        if (relic.blacklistedAccounts(to)) { revert AccountBlacklisted(to); }
        _;
    }

    modifier onlyRelic() {
        if (msg.sender != address(relic)) { revert InvalidCaller(msg.sender); }
        _;
    }

    modifier onlyTemplarMinters() {
        if (!templarMinters[msg.sender]) { revert CannotMint(msg.sender); }
        _;
    }
}