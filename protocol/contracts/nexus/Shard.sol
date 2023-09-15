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
    /// also for easy public reads(read functions). avoids cycle error
    /// choosing mapping of address to EnumerableSet to help supporting view functions like getPartnerMintInfo
    mapping(address => EnumerableSet.UintSet) private allowedPartnerShardIds;
    mapping(address => mapping(uint256 => uint256)) public allowedPartnersShardCaps;
    mapping(address => mapping(uint256 => uint256)) public partnerMintBalances;
    /// @notice keep track of all shards reserved for partners. helps to guard general mints also
    EnumerableSet.UintSet private partnerShards;
    /// @notice keep track of all other shards not reserved for partners
    EnumerableSet.UintSet private regularShards;

    /// @notice shard ids to uris
    mapping(uint256 => string) public shardUris;

    /// @notice minters who can mint for templars
    mapping(address => bool) public templarMinters;

    mapping(uint256 => Recipe) private recipes;

    /// @notice each shard belongs to exactly 1 enclave. an enclave can have many shards
    mapping(uint8 => EnumerableSet.UintSet) private enclaveShards;

    /// @notice Enclave types
    enum Enclave {
        Chaos,
        Mystery,
        Logic,
        Order,
        Structure
    }

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
    event ShardEnclaveSet(Enclave enclave, uint256 shardId);
    event RegularShardIdSet(uint256 shardId, bool allow);

    error ReservedPartnerShard(uint256 shardId);
    error ShardMintNotAllowed(address caller, uint256 shardId);
    error CannotTransmute(address caller);
    error CannotMint(address caller);
    error MintCapExceeded(uint256 cap, uint256 amount);
    error InvalidRecipe(uint256 recipeId);
    error ZeroAddress();
    error InvalidParamLength();
    error InvalidAccess(address caller);
    error InvalidCaller(address caller);
    error ERC1155MissingApprovalForAll(address msgSender, address account);
    error AccountBlacklisted(address account);
    error SetShardEnclaveFailed();
    error InvalidShard(uint256 shardId);


    constructor(
        address _relic,
        address _initialRescuer,
        address _initialExecutor,
        string memory _uri
    ) ERC1155(_uri) TempleElevatedAccess(_initialRescuer, _initialExecutor) {
        relic = IRelic(_relic);
    }

    /*
     * Set shard enclave
     * @param enclave Enclave
     * @param shardId Shard ID
     */
    function setShardEnclave(Enclave enclave, uint256 shardId) external onlyElevatedAccess {
        /// remove if shard already belongs to an enclave
        uint256 _length = uint256(uint8(Enclave.Structure)) + 1;
        uint8 enclaveIndex = uint8(enclave);
        for (uint i; i < _length;) {
            if (enclaveShards[uint8(i)].contains(shardId)) {
                /*success =*/ enclaveShards[uint8(i)].remove(shardId);
                break;
            }
            unchecked {
                ++i;
            }
        }
        // add shardId to enclave
        /*success =*/ enclaveShards[enclaveIndex].add(shardId);
        emit ShardEnclaveSet(enclave, shardId);
    }

    /*
     * Set minter for templars. That is not partner minter. Templar Minters can mint shards with IDs that
     * are not reserved for partners
     * @param minter Address of the minter
     * @param allowed If minter is allowed to mint
     */
    function setTemplarMinter(address minter, bool allowed) external onlyElevatedAccess {
        if (minter == ZERO_ADDRESS) { revert ZeroAddress(); }
        templarMinters[minter] = allowed;
        emit TemplarMinterSet(minter, allowed);
    }

    /*
     * Set single shard that partner can mint
     * @param partner Address of the partner
     * @param shardId Shard ID
     * @param allow If partner can mint
     */
    function setPartnerAllowedShardId(
        address partner,
        uint256 shardId,
        bool allow
    ) external onlyElevatedAccess {
        /// @notice admin should check shardId does not exist
        if (partner == ZERO_ADDRESS) { revert ZeroAddress(); }
        // bool success;
        if (allow) {
            /*success =*/ allowedPartnerShardIds[partner].add(shardId);
            partnerShards.add(shardId);
        } else {
            /*success =*/ allowedPartnerShardIds[partner].remove(shardId);
            partnerShards.remove(shardId);
        }
        emit PartnerAllowedShardIdSet(partner, shardId, allow);
    }

    /*
     * Set regular shard that templars can mint for themselves
     * @param shardId Shard ID
     * @param allow If shard should be added or removed
     */
    function setShardId(uint256 shardId, bool allow) external onlyElevatedAccess {
        /// @notice possible that partners are allowed to mint regular shards too
        if (allow) {
            regularShards.add(shardId);
        } else {
            regularShards.remove(shardId);
        }
        emit RegularShardIdSet(shardId, allow);
    }

    function setShardIds(uint256[] memory shardIds, bool[] memory allows) external onlyElevatedAccess {
        uint256 _length = shardIds.length;
        if (_length != allows.length) {  revert InvalidParamLength(); }
        bool allow;
        uint256 shardId;
        for (uint i; i < _length;) {
            shardId = shardIds[i];
            allow = allows[i];
            if (allow) {
                regularShards.add(shardId);
            } else {
                regularShards.remove(shardId);
            }
            emit RegularShardIdSet(shardId, allow);
            unchecked {
                ++i;
            }
        }
    }

    /*
     * Set the shard IDs partners can mint
     * @param partner Address of the partner
     * @param shardIds Shard IDs
     * @param flags If the partner can mint shard
     */
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
                /// also keep track of all partner shards, for convenience guard checks when user mints
                if (!partnerShards.contains(shardId)) {
                    partnerShards.add(shardId);
                }
            } else if (!allowed && partnerShardIds.contains(shardId)){
                /* success = */ partnerShardIds.remove(shardId);
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

    /*
     * Set the caps for shards partners can mint
     * @param partner Address of the partner
     * @param shardIds Shard IDs
     * @param caps The maximum amount partner can mint for each shard
     */
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

    /*
     * Set a recipe for transmutation
     * @param recipeId The recipe ID
     * @param recipe The recipe
     */
    function setRecipe(uint256 recipeId, Recipe calldata recipe) external onlyElevatedAccess {
        uint256 _inputLength = recipe.inputShardIds.length;
        if (_inputLength != recipe.inputShardAmounts.length) { revert CommonEventsAndErrors.InvalidParam(); }
        uint256 _outputLength = recipe.outputShardAmounts.length;
        if (_outputLength != recipe.outputShardIds.length) { revert CommonEventsAndErrors.InvalidParam(); }

        recipes[recipeId] = recipe;
        emit RecipeSet(recipeId, recipe);
    }

    /*
     * Delete recipe
     * @param recipeId The recipe ID
     */
    function deleteRecipe(uint256 recipeId) external onlyElevatedAccess {
        Recipe storage recipe = recipes[recipeId];
        if (recipe.inputShardIds.length == 0) { revert CommonEventsAndErrors.InvalidParam(); }
        delete recipes[recipeId];
        emit RecipeDeleted(recipeId);
    }

    /*
     * Set uri string of shard ID
     * @param shardId The shard ID
     * @param uri The uri string
     * @return String uri of the shard ID
     */
    function setShardUri(uint256 shardId, string memory uri) external onlyElevatedAccess {
        if (bytes(uri).length == 0 ) { revert CommonEventsAndErrors.InvalidParam(); }
        shardUris[shardId] = uri;
        emit ShardUriSet(shardId, uri);
    }

    /*
     * Get uri string of shard ID
     * @param shardId The shard ID
     * @return String uri of the shard ID
     */
    function uri(uint256 shardId) public view override returns (string memory) {
        return shardUris[shardId];
    }

    /*
     * Transmute caller shards to create a new shard using a recipe
     * Caller shards are burned and new shard(s) are minted to caller.
     * @param recipeId The ID of the recipe
     */
    function transmute(uint256 recipeId) external {
        address caller = msg.sender;
        Recipe memory recipe = recipes[recipeId];
        if (recipe.inputShardIds.length == 0) { revert InvalidRecipe(recipeId); }
        /// @dev function checks caller has enough balances
        _burnBatch(caller, recipe.inputShardIds, recipe.inputShardAmounts);
        _mintBatch(caller, recipe.outputShardIds, recipe.outputShardAmounts, "");

        emit Transmuted(caller, recipeId);
    }

    /*
     * Mint shard by partner. This is a guarded function which only allows partner contracts/addresses to mint.
     * Function checks if receiving mint address is blacklisted by Relic contract.
     * @param to The address to mint to
     * @param shardId The shard ID
     * @param amount The amount of shard ID to mint
     */
    function partnerMint(
        address to,
        uint256 shardId,
        uint256 amount
    ) external isNotBlacklisted(to) {
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

    /*
     * Mint shard in batch for partners. This is a guarded function which only allowed partner contracts/addresses to mint.
     * Function checks if receiving mint address is blacklisted by Relic contract.
     * @param to The address to mint to
     * @param shardIds The shard IDs
     * @param amounts The amount of each shard ID to mint
     */
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

    /*
     * Mint shard. This is a guarded function which only allows minter contracts can mint.
     * Function checks if receiving mint address is blacklisted by Relic contract.
     * @param to The address to mint to
     * @param shardId The shard ID
     * @param amount The amount of shard ID to mint
     */
    function mint(
        address to,
        uint256 shardId,
        uint256 amount
    ) external onlyTemplarMinters isNotBlacklisted(to) {
        // if(partnerShards.contains(shardId))  { revert ReservedPartnerShard(shardId); }
        if (!regularShards.contains(shardId)) { revert InvalidShard(shardId); }
        /// @dev fail early
        if (amount == 0) { revert CommonEventsAndErrors.InvalidParam(); }
        _mint(to, shardId, amount, "");
    }

    /*
     * Mint shard in batch. This is a guarded function which only allows minter contracts can mint.
     * Function checks if receiving mint address is blacklisted by Relic contract.
     * @param to The address to mint to
     * @param shardIds The shard IDs
     * @param amounts The amount of each shard ID to mint
     */
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
            // if(partnerShards.contains(shardId))  { revert ReservedPartnerShard(shardId); }
            if(!regularShards.contains(shardId)) { revert InvalidShard(shardId); }
            unchecked {
                ++i;
            }
        }
        _mintBatch(to, shardIds, amounts, "");
    }

    /*
     * Burn batch shards. Overriden from base contract. 
     * Modified to allow Relic contract to burn blacklisted account shards.
     * @param account The account owning the shard
     * @param ids The shard IDs
     * @param values The amounts of each shard to burn
     */
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

    /*
     * Get shard IDs a partner is allowed to mint
     * @param partner The partner
     * @return Shard IDs array
     */
    function getPartnerAllowedShardIds(address partner) external view returns (uint256[] memory) {
        return allowedPartnerShardIds[partner].values();
    }

    /*
     * Get all exclusive shard IDs of partners
     * @return shard IDs
     */
    function getAllPartnerShardIds() external view returns (uint256[] memory) {
        return partnerShards.values();
    }

    /*
     * Get all regular shard IDs
     * @return shard IDs
     */
    function getAllRegularShardIds() external view returns (uint256[] memory) {
        return regularShards.values();
    }

    /*
     * Get information about a recipe
     * @param recipeId The ID of the recipe
     * @return Recipe information struct. see above
     */
    function getRecipeInfo(uint256 recipeId) external view returns (Recipe memory info) {
        info = recipes[recipeId];
    }

    /*
     * Determines if a shard ID is reserved to a partner
     * @param shardId The shard ID
     * @return True if shardId is reserved to a partner, else false
     */
    function isPartnerShard(uint256 shardId) external view returns (bool) {
        return partnerShards.contains(shardId);
    }

    /*
     * Get shard IDs of an enclave
     * @param enclave The enclave
     * @return Shard IDs of enclave
     */
    function getEnclaveShards(Enclave enclave) external view returns (uint256[] memory) {
        return enclaveShards[uint8(enclave)].values();
    }

    /*
     * Determines if a shard ID belongs to an enclave
     * @param enclave The enclave
     * @param shardId The shard ID
     * @return True if shard ID belongs to enclave, else false.
     */
    function isEnclaveShard(Enclave enclave, uint256 shardId) external view returns (bool) {
        return enclaveShards[uint8(enclave)].contains(shardId);
    }

    /// @notice not validating partner and reverting. caller should check and handle zero values
    /*
     * Get the information of a partner
     * @param partner The partner
     * @return PartnerMintInfo struct information of partner
     */
    function getPartnerMintInfo(address partner) external view returns (PartnerMintInfo memory info) {
        EnumerableSet.UintSet storage partnerShardIds = allowedPartnerShardIds[partner];
        /// @dev workaround: storage pointer is not implicitly convertible to expected type uint256[] memory
        /// also have to cast enumerable set to uint256[] to be able to return. 
        /// Types containing (nested) mappings can only be parameters or return variables of internal or library functions
        uint256 _length = partnerShardIds.length();
        info.shardIds = new uint256[](_length);
        info.balances = new uint256[](_length);
        info.caps = new uint256[](_length);
        uint256 shardId;
        for (uint i = 0; i < _length;) {
            shardId = partnerShardIds.at(i);
            info.shardIds[i] = shardId;
            info.balances[i] = partnerMintBalances[partner][shardId];
            info.caps[i] = allowedPartnersShardCaps[partner][shardId];
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