pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (nexus/Shard.sol)

import { IRelic } from "../interfaces/nexus/IRelic.sol";
import { IShard } from "../interfaces/nexus/IShard.sol";
import { INexusCommon } from "../interfaces/nexus/INexusCommon.sol";
import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { ERC1155Burnable } from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { ElevatedAccess } from "./access/ElevatedAccess.sol";
import { CommonEventsAndErrors } from "../common/CommonEventsAndErrors.sol";


/* @notice Shard contract
 * Shard.sol is a ERC1155 implementation that allows partners and permitted entities to mint so called shards.
 * A Shard can be equipped into a Relic. Unlike Relics, shard IDs are not unique and this means many shards with 
 * the same ID can be minted by allowed entities. Permitted entities mints are controlled by caps for shards.
 * Each Shard belongs to 1 enclave, but an enclave can have many Shards.
 * Shards are the collection pieces and enable collaboration with partners. Shards can be equipped into Relics.
 */
contract Shard is IShard, ERC1155, ERC1155Burnable, ElevatedAccess {
    using EnumerableSet for EnumerableSet.UintSet;
    /// @notice Relic NFT contract
    IRelic public immutable relic;
    INexusCommon public nexusCommon;
    uint256 private constant START_TOKEN_ID = 1;
    /// @notice current token index
    uint256 private _currentIndex;
    /// @notice current recipe index
    uint256 private _currentRecipeIndex;

    /// @notice all 3 mappings below not combined into a struct for reasons allowedShardIds is read often than the rest. 
    /// also for easy public reads(read functions). avoids cycle error
    /// choosing mapping of address to EnumerableSet to help supporting view functions like getMintInfo
    mapping(address => EnumerableSet.UintSet) private allowedShardIds;
    mapping(address => mapping(uint256 => uint256)) public override allowedShardCaps;
    mapping(address => mapping(uint256 => uint256)) public override mintBalances;

    /// @notice shard ids to uris
    mapping(uint256 => string) private shardUris;
    /// @notice Recipe for transmutation of shards.
    mapping(uint256 => Recipe) private recipes;
    /// @notice track total mints for each shard
    mapping(uint256 => uint256) public override totalShardMints;


    constructor(
        address _relic,
        address _nexusCommon,
        address _initialExecutor,
        string memory _uri
    ) ERC1155(_uri) ElevatedAccess(_initialExecutor) {
        relic = IRelic(_relic);
        nexusCommon = INexusCommon(_nexusCommon);
        _currentIndex = _currentRecipeIndex = START_TOKEN_ID;
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
     * @notice Enable minters to mint new shards, one after the next. If there are two minters and next shard ID
     * is 3, minter 1 and minter 2 can mint shard IDs 3 and 4 respectively
     * @param minters Minters to enable for new shards
     */
    function setNewMinterShards(
        address[] calldata minters
    ) external override onlyElevatedAccess returns (uint256[] memory shards){
        uint256 _length = minters.length;
        if (_length == 0) { revert InvalidParamLength(); }
        shards = new uint256[](_length);
        uint256 shardId;
        for (uint i; i < _length;) {
            shardId = nextTokenId();
            _currentIndex = shardId + 1;
            _setMinterAllowedShardId(minters[i], shardId, true);
            shards[i] = shardId;
            unchecked {
                ++i;
            }
        }
    }

    function _setMinterAllowedShardId(
        address minter,
        uint256 shardId,
        bool allow
    ) internal {
        if (minter == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        if (shardId >= nextTokenId()) { revert CommonEventsAndErrors.InvalidParam(); }
        if (allow) {
            allowedShardIds[minter].add(shardId);
        } else {
            allowedShardIds[minter].remove(shardId);
        }
        emit MinterAllowedShardIdSet(minter, shardId, allow); 
    }

    /*
     * @notice Set multiple shard IDs that minter can mint. This is an explicit setting.
     * Shard ID must exist. To enable minter for a new shard, use function setNewMinterShards
     * @param minter Address of the minter
     * @param shardIds Shard IDs
     * @param allow Booleans for if the partner can mint shards
     */
    function setMinterAllowedShardIds(
        address minter,
        uint256[] calldata shardIds,
        bool[] calldata allow
    ) external override onlyElevatedAccess {
        uint256 _length = shardIds.length;
        if (_length != allow.length) { revert InvalidParamLength(); }
        bool allowed;
        uint256 shardId;
        for (uint i; i < _length;) {
            allowed = allow[i];
            shardId = shardIds[i];
            _setMinterAllowedShardId(minter, shardId, allowed);
            unchecked {
                ++i;
            }
        }
    }

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
    ) external override onlyElevatedAccess {
        if (minter == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        uint256 _length = shardIds.length;
        if (_length != caps.length) { revert InvalidParamLength(); }
        uint256 shardId;
        uint256 cap;
        for (uint i; i < _length; ) {
            shardId = shardIds[i];
            if (!allowedShardIds[minter].contains(shardId)) { revert CommonEventsAndErrors.InvalidAddress(); }
            cap = caps[i];
            allowedShardCaps[minter][shardId] = cap;
            emit MinterAllowedShardCapSet(minter, shardId, cap);
            unchecked {
                ++i;
            }
        }
    }

    /*
     * @notice Add a recipe for transmutation
     * @param recipe The recipe
     */
    function addRecipe(Recipe calldata recipe) external override onlyElevatedAccess {
        uint256 _inputLength = recipe.inputShardIds.length;
        if (_inputLength != recipe.inputShardAmounts.length) { revert CommonEventsAndErrors.InvalidParam(); }
        uint256 _outputLength = recipe.outputShardAmounts.length;
        if (_outputLength != recipe.outputShardIds.length) { revert CommonEventsAndErrors.InvalidParam(); }

        uint256 recipeId = nextRecipeId();
        recipes[recipeId] = recipe;
        _currentRecipeIndex = recipeId + 1;
        emit RecipeSet(recipeId, recipe);
    }

    /*
     * @notice Delete recipe
     * @param recipeId The recipe ID
     */
    function deleteRecipe(uint256 recipeId) external override onlyElevatedAccess {
        if (recipes[recipeId].inputShardIds.length == 0) { revert CommonEventsAndErrors.InvalidParam(); }
        delete recipes[recipeId];
        emit RecipeDeleted(recipeId);
    }

    /*
     * @notice Set uri string of shard ID
     * @param shardId The shard ID
     * @param uri The uri string
     * @return String uri of the shard ID
     */
    function setShardUri(uint256 shardId, string memory _uri) external override onlyElevatedAccess {
        if (bytes(_uri).length == 0 ) { revert CommonEventsAndErrors.InvalidParam(); }
        shardUris[shardId] = _uri;
        emit ShardUriSet(shardId, _uri);
    }

    /*
     * @notice Get uri string of shard ID
     * @param shardId The shard ID
     * @return String uri of the shard ID
     */
    function uri(uint256 shardId) public view override(ERC1155, IShard) returns (string memory) {
        return shardUris[shardId];
    }

    /*
     * @notice Transmute caller shards to create a new shard using a recipe
     * Caller shards are burned and new shard(s) are minted to caller.
     * @param recipeId The ID of the recipe
     */
    function transmute(uint256 recipeId) external override {
        address caller = msg.sender;
        Recipe memory recipe = recipes[recipeId];
        if (recipe.inputShardIds.length == 0) { revert InvalidRecipe(recipeId); }
        /// @dev function checks caller has enough balances
        _burnBatch(caller, recipe.inputShardIds, recipe.inputShardAmounts);
        _mintBatch(caller, recipe.outputShardIds, recipe.outputShardAmounts, "");

        emit Transmuted(caller, recipeId);
    }
    
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
        uint256[] calldata shardIds,
        uint256[] calldata amounts
    ) external override isNotBlacklisted(to){
        uint256 _length = shardIds.length;
        if (_length != amounts.length) { revert InvalidParamLength(); }
        uint256 cap;
        uint256 shardId;
        uint256 amount;
        EnumerableSet.UintSet storage minterShards = allowedShardIds[msg.sender];
        mapping(uint256 => uint256) storage minterShardCaps = allowedShardCaps[msg.sender];
        uint256 newBalance;
        for (uint i; i < _length;) {
            shardId = shardIds[i];
            if (!minterShards.contains(shardId)) { revert CannotMint(shardId); }
            amount = amounts[i];
            cap = minterShardCaps[shardId];
            newBalance =  mintBalances[msg.sender][shardId] + amount;
            /// @dev checking only if cap set. 0 (default value) is uncapped
            if (cap > 0 && cap < newBalance) {
                revert MintCapExceeded(cap, amount);
            }
            mintBalances[msg.sender][shardId] = newBalance;
            totalShardMints[shardId] += amount;
            unchecked {
                ++i;
            }
        }
        _mintBatch(to, shardIds, amounts, "");
    }

    /*
     * @notice Burn batch shards. Overriden from base contract. 
     * Modified to allow Relic contract to burn blacklisted account shards.
     * @param account The account owning the shard
     * @param ids The shard IDs
     * @param values The amounts of each shard to burn
     */
    function burnBatch(
        address account,
        uint256[] memory ids,
        uint256[] memory values
    ) public override(ERC1155Burnable, IShard) {
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
     * @notice Get shard IDs a minter is allowed to mint
     * @param minter The minter with perms
     * @return Shard IDs array
     */
    function getMinterAllowedShardIds(address minter) external override view returns (uint256[] memory) {
        return allowedShardIds[minter].values();
    }

    /*
     * @notice Get next Shard Id
     * @return ID
     */
    function nextTokenId() public override view returns (uint256) {
        return _currentIndex;
    }

    /*
     * @notice Check if given ID is a valid shard ID
     * @param id The ID to check
     * @return If ID is a valid shard
     */
    function isShardId(uint256 id) external override view returns (bool) {
        return START_TOKEN_ID <= id && id < nextTokenId();
    }

    /*
     * @notice Get information about a recipe
     * @param recipeId The ID of the recipe
     * @return Recipe information struct. see above
     */
    function getRecipeInfo(uint256 recipeId) external override view returns (Recipe memory info) {
        info = recipes[recipeId];
    }

    /*
     * @notice Get next Recipe Id
     * @return Id of recipe
     */
    function nextRecipeId() public override view returns (uint256) {
        return _currentRecipeIndex;
    }

    /*
     * @notice Get the information of a minter. 
     * Function is not validating minter and reverting. Caller should check and handle zero values
     * @param minter The minter
     * @return MintInfo struct information of minter
     */
    function getMintInfo(address minter) external override view returns (MintInfo[] memory info) {
        EnumerableSet.UintSet storage minterShards = allowedShardIds[minter];
        uint256 _length = minterShards.length();
        info = new MintInfo[](_length);
        uint256 shardId;
        for (uint i = 0; i < _length;) {
            shardId = minterShards.at(i);
            info[i] = MintInfo({
                shardId: shardId,
                balance: mintBalances[minter][shardId],
                cap: allowedShardCaps[minter][shardId]
            });
            unchecked {
                ++i;
            }
        }
    }

    modifier isNotBlacklisted(address to) {
        if (relic.blacklistedAccounts(to)) { revert CommonEventsAndErrors.AccountBlacklisted(to); }
        _;
    }
}