pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @notice interfaced from Relic.sol to obtain
 * information from Relic.sol regarding enclave type.
 */
interface IRelic {
    function getRelicInfos(uint256 enclaves) external returns (uint256);
}

/**
Intended contract specs:
* 1) Interface with Relic and Shards
* 2) Implement EIP 712 to concatenate signed message, expected deadline and expected nonce into a hash
* 3) Recover the address of the account calling the function using the digest and signature through this hash
* 4) Map Shards to each enclave
* 5) Allow a verified signer to mint the chosen Enclave Shard

*/
/**
 * @notice interfaced from Shards.sol to obtain address, token Id, amount owned and stored data
 * for future use
 */
interface IShards {
    function partnerMint(
        address account,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) external;
}

/**
 * @title This contract aims to allow a user to mint
 * an Enclave Shard corresponding to the Enclave quest
 * upon reaching the winning state of Path of the Temple.
 * It uses EIP712 to verify that a user has signed the hashed message
 */
contract PathofTheTemplarShard is Ownable {
    IShards private SHARDS;
    IRelic private RELIC;
    //Mapping SHARD_ID to the individual enclaves
    uint256[] public SHARD_ID = [2, 3, 4, 5, 6];
    string[] public ENCLAVE = [
        "",
        "chaosEnclave",
        "mysteryEnclave",
        "logicEnclave",
        "structureEnclave",
        "orderEnclave"
    ];

    using Counters for Counters.Counter;

    // Defining the CONSTANTS which are of bytes32 type
    bytes32 constant MINTREQUEST_TYPEHASH =
        keccak256("MintRequest(address signer,uint256 deadline,uint256 nonce)");
    bytes32 constant EIP712DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId)");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public immutable DOMAIN_SEPARATOR;

    // MintRequest struct has variables of account, deadline and nonce types.
    struct MintRequest {
        address account;
        uint256 deadline;
        uint256 nonce;
    }

    // Defining EIP712 Domain struct with variables of name, version and chain id.
    struct EIP712Domain {
        string name;
        string version;
        uint256 chainId;
    }

    //error definition for when msg.sender is not signer
    error MintForbidden();
    error InvalidMint(address account);

    // error definitions for passing checks related to the hashed message and signature
    error DeadlineExpired(uint256 lateBy);
    error InvalidNonce(address account);
    error InvalidSignature(address account);

    // MinterSet event takes the minter and value as parameters once an address calling the setMinter function
    // passes the check to be updated with the minter role
    event MinterSet(address indexed minter, bool value);

    // modifier applied so that if the account calling the function is not the minter, the tx will
    // revert with the Mint Forbidden message.
    modifier canMint() {
        if (!minters[msg.sender]) {
            revert MintForbidden();
        }

        _;
    }
    //mapping role for minting to the address calling mint function if check is passed
    mapping(address => bool) public minters;
    //mapping the Shard ID from its declared array to the Enclave names
    mapping(uint256 => string) public shardToEnclave;
    // mapping address to nonces for incremental counter
    mapping(address => Counters.Counter) public nonces;

    // Constructor occurs just once during deployment of contract
    // original deployer is granted the default admin role
    // Shards and domain separator constant is initialised
    // using name, version and Arbitrum Goerli chainID.
    constructor(IShards shards) {
        if (msg.sender != owner()) {
            revert("Only contract owner can deploy");
        }

        SHARDS = shards;
        DOMAIN_SEPARATOR = hash(
            EIP712Domain({
                name: "PathofTheTemplarShard",
                version: "1",
                chainId: 421613
            })
        );
    }

    // mintShard grants the address calling this function the ability to mint if the check
    // using EIP712 standard below are passed (with signature verification, deadline and nonce)
    function mintShard(uint256 _shardIndex) external canMint {
        if (_shardIndex < SHARD_ID.length || _shardIndex > SHARD_ID.length) {
            revert InvalidMint(msg.sender);
        }
        SHARDS.partnerMint(msg.sender, SHARD_ID[_shardIndex], 1, "");
    }

    //for loop checks if the Enclave name matches the Shard ID
    function establishMapping() public {
        // Establish the mapping between SHARD_ID and ENCLAVE
        for (uint256 i = 2; i < SHARD_ID.length; i++) {
            shardToEnclave[SHARD_ID[i]] = ENCLAVE[i];
        }
    }

    // Shard Id corresponding to Enclave can be viewed publically by anyone calling this function
    function getEnclaveForShard(
        uint256 shardId
    ) public view returns (string memory) {
        return shardToEnclave[shardId];
    }

    // Only contract owner may call the minter role for an account that has passed the check.
    // the minter role corresponding to the account that passed is stored in value.
    function setMinter(address account, bool value) external onlyOwner {
        minters[account] = value;
        //emit the new role for the account
        emit MinterSet(account, value);
    }

    // Function takes two parameters request and signature
    function relayMintRequestFor(
        MintRequest calldata request,
        bytes calldata signature
    ) external {
        //concatenates the three values into a hash readable as a digest via a keccak256 hash function
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, hash(request))
        );
        // stores address into signer and error recovery in err and use recover to verify digest and signature
        // is from address calling function
        (address minter, ECDSA.RecoverError err) = ECDSA.tryRecover(
            digest,
            signature
        );
        // Check for error in signature recovery process
        if (err != ECDSA.RecoverError.NoError) {
            revert InvalidSignature(request.account);
        }
        // Check for error if deadline is expired
        if (block.timestamp > request.deadline)
            revert DeadlineExpired(block.timestamp - request.deadline);
        // Check for error if requesting address matches signer
        if (minter != request.account) revert InvalidSignature(request.account);
        // Checks for error if nonce is valid for requesting address
        if (_useNonce(request.account) != request.nonce)
            revert InvalidNonce(request.account);

        minters[request.account] = true;
        emit MinterSet(request.account, true);
    }

    /**
     * "Consume a nonce": return the current value and increment. This would be done by the dev wallet
     * which is owner of the contract (ie trusted TEMPLE EOA)
     */
    function _useNonce(address _owner) internal returns (uint256 current) {
        Counters.Counter storage nonce = nonces[_owner];
        current = nonce.current();
        nonce.increment();
    }

    /**
     * @dev hash function stores custom data type QuestCompletedMessageReq as input
     * in a bytes32 hash from data input values of name, version and chainId.
     */
    function hash(EIP712Domain memory _input) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    EIP712DOMAIN_TYPEHASH,
                    keccak256(bytes(_input.name)),
                    keccak256(bytes(_input.version)),
                    _input.chainId
                )
            );
    }

    /**
     * @dev functions creates a hash from signer, deadline and nonce and returns it as a bytes32 hash.
     */
    function hash(MintRequest memory _input) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    MINTREQUEST_TYPEHASH,
                    _input.account,
                    _input.deadline,
                    _input.nonce
                )
            );
    }

    // function creates a hash from input and returns it as a bytes32 hash
    function hash(uint256[] memory _input) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_input));
    }
}
