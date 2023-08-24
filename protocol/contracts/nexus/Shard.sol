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
    event PartnerAllowedShardIdsSet(address partner, uint256[] shardIds, bool[] allowances);
    event PartnerAllowedShardCapsSet(address partner, uint256[] shardIds, uint256[] caps);
    event TemplarMinterSet(address minter, bool allowed);

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


    constructor(
        IRelic _relic,
        string memory _uri
    ) ERC1155(_uri) TempleElevatedAccess(msg.sender, msg.sender) {
        relic = _relic;
    }

    /// @notice shardId should not have been minted, nextId =< shardId 
    function setPartnerAllowedShardId(address partner, uint256 shardId, bool allowed) external onlyElevatedAccess {
        /// @notice admin should check shardId does not exist
        if (partner == ZERO_ADDRESS) { revert ZeroAddress(); }
        bool success;
        // allowedPartnerShardIds[partner][shardId] = allowed;
        if (allowed) {
            success = allowedPartnerShardIds[partner].add(shardId);
            if (!success) { revert PartnerAllowShardFailed(partner, shardId, allowed); }
            partnerShards.add(shardId);
        } else {
            success = allowedPartnerShardIds[partner].remove(shardId);
            if (!success) { revert PartnerAllowShardFailed(partner, shardId, allowed); }
            partnerShards.remove(shardId);
        }
    }

    function setTemplarMinter(address minter, bool allowed) external onlyElevatedAccess {
        if (minter == ZERO_ADDRESS) { revert ZeroAddress(); }
        templarMinters[minter] = allowed;
        emit TemplarMinterSet(minter, allowed);
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
         bool success;
         if (_length != flags.length) { revert InvalidParamLength(); }
         for (uint i; i < _length;) {
            allowed = flags[i];
            shardId = shardIds[i];
            // allowedPartnerShardIds[partner][shardId] = allowed;
            EnumerableSet.UintSet storage partnerShardIds = allowedPartnerShardIds[partner];
            /// @dev will return false if value already exists in set
            if (allowed && !partnerShardIds.contains(shardId)) {
                success = partnerShardIds.add(shardId);
                if (!success) { revert PartnerAllowShardFailed(partner, shardId, allowed); }
                // also keep track of all partner shards, for convenience guard checks when user mints
                if (!partnerShards.contains(shardId)) {
                    success = partnerShards.add(shardId);
                    if (!success) { revert PartnerAllowShardFailed(partner, shardId, allowed); }
                }
            } else if (!allowed && partnerShardIds.contains(shardId)){
                success = partnerShardIds.remove(shardId);
                if (!success) { revert PartnerAllowShardFailed(partner, shardId, allowed); }
                if (partnerShards.contains(shardId)) {
                    success = partnerShards.remove(shardId);
                    if (!success) { revert PartnerAllowShardFailed(partner, shardId, allowed); }
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

        Recipe memory newRecipe;
        assembly {
            newRecipe := recipe
        }
        recipes[recipeId] = newRecipe;
        emit RecipeSet(recipeId, recipe);
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

    function partnerMint(address to, uint256 shardId, uint256 amount) external {
        if (!allowedPartnerShardIds[msg.sender].contains(shardId)) { revert ShardMintNotAllowed(msg.sender, shardId); }
        // default 0 value means uncapped
        uint256 cap = allowedPartnersShardCaps[msg.sender][shardId];
        if (cap > 0 && cap < amount) {
            revert MintCapExceeded(cap, amount);
        }
        partnerMintBalances[msg.sender][shardId] += amount;
        /// @notice not duplicating variable for tracking partner mint because only partner can mint to given addresses
        _mint(to, shardId, amount, "");
    }

    /// @notice Lets an approved partner mint shards in batch
    function partnerBatchMint(address to, uint256[] memory shardIds, uint256[] memory amounts) external {
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
            partnerMintBalances[msg.sender][shardId] += amount;
            unchecked {
                ++i;
            }
        }
        _mintBatch(to, shardIds, amounts, "");
    }

    function mint(address to, uint256 shardId, uint256 amount) external onlyTemplarMinters {
        if(partnerShards.contains(shardId))  { revert ReservedPartnerShard(shardId); }
        /// @dev fail early
        if (amount == 0) { revert CommonEventsAndErrors.InvalidParam(); }
        _mint(to, shardId, amount, "");
    }

    function mintBatch(
        address to,
        uint256[] memory shardIds,
        uint256[] memory amounts
    ) external onlyTemplarMinters {
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

    function burnBatch(address account, uint256[] memory ids, uint256[] memory values) public override {
        if (_msgSender() == address(relic)) {
            _burnBatch(account, ids, values);
            return;
        } else if (account != _msgSender() && !isApprovedForAll(account, _msgSender())) {
            revert ERC1155MissingApprovalForAll(_msgSender(), account);
        }

        _burnBatch(account, ids, values);
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