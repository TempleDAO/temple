pragma solidity 0.8.18;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (nexus/IShard.sol)
import { IShard } from "../interfaces/nexus/IShard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { Counters } from "@openzeppelin/contracts/utils/Counters.sol";

contract TemplarShard is Ownable {
    using EnumerableSet for EnumerableSet.UintSet;
    uint256 shardId = [1, 2, 3, 4, 5];

    interface IShards {
        function setTemplarMinter(
            address minter, 
            bool allowed
        ) external;
        
        function setPartnerAllowedShardCaps(
            address partner,
            uint256[] memory shardIds,
            uint256[] memory caps
        ) external;

        function setShardUri(
            uint256 shardId, 
            string memory uri
        ) external;
    }

    // Defining EIP712 Domain struct with variables of name, version and chain id.
    struct EIP712Domain {
        string name;
        string version;
        uint256 chainId;
    }

    mapping(uint256 => string) public shardToEnclave;
    mapping(address => Counters.Counter) public nonces;

    event ShardMinted();
    event ShardUriSet(uint256 shardId, string uri);
    event TemplarMinterSet(address minter, bool allowed);
    event ShardEnclaveSet(Enclave enclave, uint256 shardId);

    DOMAIN_SEPARATOR = hash(
        EIP712Domain({
            name: "TemplarShard",
            version: "1",
            chainId: 421613
        })
    );

    function _relayMintRequestFor(
        MintRequest calldata request,
        bytes calldata signature
    ) internal {
        //concatenates the three values into a hash readable as a digest via a keccak256 hash function
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, hash(request))
        );
        // stores address into signer and error recovery in err and use recover to verify digest and signature
        // is from address calling function
        (address caller, ECDSA.RecoverError err) = ECDSA.tryRecover(
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
        // Check for error if signer is whitelisted minter
        if (!minters[caller]) revert SignerIsNotMinter(caller);
        // Checks for error if nonce is valid for requesting address
        if (_useNonce(request.account) != request.nonce)
            revert InvalidNonce(request.account);

        emit TemplarMinterSet(minter, allowed);
    }

    /**
     * "Consume a nonce": return the current value and increment. This would be done by the dev wallet
     * which is owner of the contract (ie trusted TEMPLE EOA)
     */
    function _useNonce(address _minter) internal returns (uint256 current) {
        Counters.Counter storage nonce = nonces[_minter];
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