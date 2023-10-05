pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (nexus/Shard.sol)

import { IRelic } from "../../interfaces/nexus/IRelic.sol";
import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { ERC1155Burnable } from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { CommonEventsAndErrors } from "../../common/CommonEventsAndErrors.sol";

contract Shard is ERC1155, ERC1155Burnable {
    using EnumerableSet for EnumerableSet.UintSet;
    /// @notice Relic NFT contract
    IRelic public relic;
    address private constant ZERO_ADDRESS = 0x0000000000000000000000000000000000000000;
    /// @notice current token index
    uint256 private _currentIndex;
    /// @notice current recipe index
    uint256 private _currentRecipeIndex;

    /// @notice all 3 mappings below not combined into a struct for reasons allowedShardIds is read often than the rest. 
    /// also for easy public reads(read functions). avoids cycle error
    /// choosing mapping of address to EnumerableSet to help supporting view functions like getMintInfo
    mapping(address => EnumerableSet.UintSet) private allowedShardIds;
    mapping(address => mapping(uint256 => uint256)) public allowedShardCaps;
    mapping(address => mapping(uint256 => uint256)) public mintBalances;
    /// @notice keep track of all shards
    // EnumerableSet.UintSet private shards;

    /// @notice shard ids to uris
    mapping(uint256 => string) private shardUris;
    /// @notice Recipe for transmutation of shards.
    mapping(uint256 => Recipe) private recipes;
    /// @notice each shard belongs to exactly 1 enclave. an enclave can have many shards
    mapping(uint8 => EnumerableSet.UintSet) private enclaveShards;
    /// @notice track total mints for each shard
    mapping(uint256 => uint256) public totalShardMints;

    /// @notice operators for testnet
    mapping(address => bool) public operators;


    /// @notice Enclave types
    enum Enclave {
        Chaos,
        Mystery,
        Logic,
        Order,
        Structure,
        None
    }

    /// @notice for compact view functions
    struct MintInfo {
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
    event ShardUriSet(uint256 shardId, string uri);
    event RecipeSet(uint256 recipeId, Recipe recipe);
    event RecipeDeleted(uint256 recipeId);
    event ShardEnclaveSet(Enclave enclave, uint256 shardId);
    event ShardIdSet(uint256 shardId, bool allow);
    event MinterAllowedShardIdSet(address partner, uint256 shardId, bool allow);
    event MinterAllowedShardCapSet(address minter, uint256 shardId, uint256 cap);
    event OperatorSet(address operator, bool allow);

    error CannotMint(uint256 shardId);
    error MintCapExceeded(uint256 cap, uint256 amount);
    error InvalidRecipe(uint256 recipeId);
    error ZeroAddress();
    error InvalidParamLength();
    error InvalidAccess(address caller);
    error ERC1155MissingApprovalForAll(address msgSender, address account);


    constructor(
        address _relic,
        string memory _uri
    ) ERC1155(_uri) {
        relic = IRelic(_relic);
        _currentIndex = _currentRecipeIndex = _startTokenId();
    }

    function setOperator(address operator, bool allow) external onlyOperator {
        operators[operator] = allow;
        emit OperatorSet(operator, allow);
    }

    function setNewMinterShard(address minter) external onlyOperator returns (uint256) {
        uint256 shardId = _nextTokenId();
        _currentIndex += 1;
        _setMinterAllowedShardId(minter, shardId, true);
        return shardId;
    }

    function setNewMinterShards(
        address[] calldata minters
    ) external onlyOperator returns (uint256[] memory shards){
        uint256 _length = minters.length;
        if (_length == 0) { revert InvalidParamLength(); }
        shards = new uint256[](_length);
        uint256 shardId;
        for (uint i; i < _length;) {
            shardId = _nextTokenId();
            _currentIndex += 1;
            _setMinterAllowedShardId(minters[i], shardId, true);
            shards[i] = shardId;
            unchecked {
                ++i;
            }
        }
    }

    /*
     * @notice Set shard enclave
     * @param enclave Enclave
     * @param shardId Shard ID
     */
    function setShardEnclave(Enclave enclave, uint256 shardId) external onlyOperator {
        /// remove if shard already belongs to an enclave
        uint256 _length = uint256(uint8(Enclave.Structure)) + 1;
        uint8 enclaveIndex = uint8(enclave);
        for (uint i; i < _length;) {
            /// @dev checking set contains shard in a loop with a break. avoid worst case by calling remove _length times
            if (enclaveShards[uint8(i)].contains(shardId)) {
                enclaveShards[uint8(i)].remove(shardId);
                break;
            }
            unchecked {
                ++i;
            }
        }
        // add shardId to enclave
        enclaveShards[enclaveIndex].add(shardId);
        emit ShardEnclaveSet(enclave, shardId);
    }

    /*
     * @notice Set shard ID that minter(caller) is allowed to mint.
     * @param minter Address of the minter
     * @param shardId Shard ID
     * @param allowed If minter is allowed to mint
     */
    function setMinterAllowedShardId(
        address minter,
        uint256 shardId,
        bool allow
    ) external onlyOperator {
        _setMinterAllowedShardId(minter, shardId, allow);
    }

    function _setMinterAllowedShardId(
        address minter,
        uint256 shardId,
        bool allow
    ) internal {
        if (minter == ZERO_ADDRESS) { revert ZeroAddress(); }
        if (shardId >= _nextTokenId()) { revert CommonEventsAndErrors.InvalidParam(); }
        if (allow) {
            allowedShardIds[minter].add(shardId);
        } else {
            allowedShardIds[minter].remove(shardId);
        }
        emit MinterAllowedShardIdSet(minter, shardId, allow); 
    }

    /*
     * @notice Set multiple shard IDs that minter can mint 
     * @param minter Address of the minter
     * @param shardIds Shard IDs
     * @param flags Booleans for if the partner can mint shards
     */
    function setMinterAllowedShardIds(
        address minter,
        uint256[] calldata shardIds,
        bool[] calldata flags
    ) external onlyOperator {
        if (minter == ZERO_ADDRESS) { revert ZeroAddress(); }
        uint256 _length = shardIds.length;
        if (_length != flags.length) { revert InvalidParamLength(); }
        bool allowed;
        uint256 shardId;
        for (uint i; i < _length;) {
            allowed = flags[i];
            shardId = shardIds[i];
            if (shardId >= _nextTokenId()) { revert CannotMint(shardId); }
            EnumerableSet.UintSet storage minterShardIds = allowedShardIds[minter];
            if (allowed) {
                minterShardIds.add(shardId);
            } else {
                minterShardIds.remove(shardId);
            }
            emit MinterAllowedShardIdSet(minter, shardId, allowed);
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
    ) external onlyOperator {
        if (minter == ZERO_ADDRESS) { revert ZeroAddress(); }
        uint256 _length = shardIds.length;
        if (_length != caps.length) { revert InvalidParamLength(); }
        uint256 shardId;
        uint256 cap;
        for (uint i; i < _length; ) {
            shardId = shardIds[i];
            cap = caps[i];
            allowedShardCaps[minter][shardId] = cap;
            emit MinterAllowedShardCapSet(minter, shardId, cap);
            unchecked {
                ++i;
            }
        }
    }

    /*
     * @notice Set a recipe for transmutation
     * @param recipeId The recipe ID
     * @param recipe The recipe
     */
    function setRecipe(Recipe calldata recipe) external onlyOperator {
        uint256 _inputLength = recipe.inputShardIds.length;
        if (_inputLength != recipe.inputShardAmounts.length) { revert CommonEventsAndErrors.InvalidParam(); }
        uint256 _outputLength = recipe.outputShardAmounts.length;
        if (_outputLength != recipe.outputShardIds.length) { revert CommonEventsAndErrors.InvalidParam(); }

        uint256 recipeId = _nextRecipeId();
        recipes[recipeId] = recipe;
        _currentRecipeIndex += 1;
        emit RecipeSet(recipeId, recipe);
    }

    /*
     * @notice Delete recipe
     * @param recipeId The recipe ID
     */
    function deleteRecipe(uint256 recipeId) external onlyOperator {
        // if (recipeId >= _nextRecipeId())
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
    function setShardUri(uint256 shardId, string memory _uri) external onlyOperator {
        if (bytes(_uri).length == 0 ) { revert CommonEventsAndErrors.InvalidParam(); }
        shardUris[shardId] = _uri;
        emit ShardUriSet(shardId, _uri);
    }

    /*
     * @notice Get uri string of shard ID
     * @param shardId The shard ID
     * @return String uri of the shard ID
     */
    function uri(uint256 shardId) public view override returns (string memory) {
        return shardUris[shardId];
    }

    /*
     * @notice Transmute caller shards to create a new shard using a recipe
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
     * @notice Mint shard. This is a guarded function which only allows callers with perms to mint.
     * Function checks if receiving mint address is blacklisted by Relic contract.
     * If caps is set on shard ID for caller, new balance is checked.
     * @param to The address to mint to
     * @param shardId The shard ID
     * @param amount The amount of shard ID to mint
     */
    function mint(
        address to,
        uint256 shardId,
        uint256 amount
    ) external isNotBlacklisted(to) {
        if (!allowedShardIds[msg.sender].contains(shardId)) { revert CannotMint(shardId); }
        /// @dev fail early
        if (amount == 0) { revert CommonEventsAndErrors.InvalidParam(); }
        // default cap 0 value means uncapped
        uint256 cap = allowedShardCaps[msg.sender][shardId];
        uint256 newBalance = mintBalances[msg.sender][shardId] + amount;
        if (cap > 0 && newBalance > cap) {
            revert MintCapExceeded(cap, newBalance);
        }
        mintBalances[msg.sender][shardId] = newBalance;
        totalShardMints[shardId] += amount;
        _mint(to, shardId, amount, "");
        /// @dev track event with TransferSingle
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
    ) external isNotBlacklisted(to){
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
     * @notice Get shard IDs a minter is allowed to mint
     * @param minter The minter with perms
     * @return Shard IDs array
     */
    function getMinterAllowedShardIds(address minter) external view returns (uint256[] memory) {
        return allowedShardIds[minter].values();
    }

    function nextTokenId() external view returns (uint256) {
        return _nextTokenId();
    }

    /*
     * @notice Check if given ID is a valid shard ID
     * @param id The ID to check
     * @return If ID is a valid shard
     */
    function isShardId(uint256 id) external view returns (bool) {
        return _startTokenId() <= id && id < _nextTokenId();
    }

    /*
     * @notice Get information about a recipe
     * @param recipeId The ID of the recipe
     * @return Recipe information struct. see above
     */
    function getRecipeInfo(uint256 recipeId) external view returns (Recipe memory info) {
        info = recipes[recipeId];
    }

    function nextRecipeId() external view returns (uint256) {
        return _currentRecipeIndex;
    }

    /*
     * @notice Get shard IDs of an enclave
     * @param enclave The enclave
     * @return Shard IDs of enclave
     */
    function getEnclaveShards(Enclave enclave) external view returns (uint256[] memory) {
        return enclaveShards[uint8(enclave)].values();
    }

    /*
     * @notice Determines if a shard ID belongs to an enclave
     * @param enclave The enclave
     * @param shardId The shard ID
     * @return True if shard ID belongs to enclave, else false.
     */
    function isEnclaveShard(Enclave enclave, uint256 shardId) external view returns (bool) {
        return enclaveShards[uint8(enclave)].contains(shardId);
    }

    /*
     * @notice Get the information of a minter. 
     * Fucntion is not validating minter and reverting. Caller should check and handle zero values
     * @param minter The minter
     * @return MintInfo struct information of minter
     */
    function getMintInfo(address minter) external view returns (MintInfo memory info) {
        EnumerableSet.UintSet storage minterShards = allowedShardIds[minter];
        uint256 _length = minterShards.length();
        info.shardIds = new uint256[](_length);
        info.balances = new uint256[](_length);
        info.caps = new uint256[](_length);
        uint256 shardId;
        for (uint i = 0; i < _length;) {
            shardId = minterShards.at(i);
            info.shardIds[i] = shardId;
            info.balances[i] = mintBalances[minter][shardId];
            info.caps[i] = allowedShardCaps[minter][shardId];
            unchecked {
                ++i;
            }
        }
    }

    function _startTokenId() internal pure returns (uint256) {
        return 1;
    }

    function _nextTokenId() internal view returns (uint256) {
        return _currentIndex;
    }

    function _nextRecipeId() internal view returns (uint256) {
        return _currentRecipeIndex;
    }

    modifier isNotBlacklisted(address to) {
        if (relic.blacklistedAccounts(to)) { revert CommonEventsAndErrors.AccountBlacklisted(to); }
        _;
    }

    modifier onlyOperator() {
        if (!operators[msg.sender]) { revert InvalidAccess(msg.sender); }
        _;
    }
}