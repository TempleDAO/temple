// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./OpeningCeremony.sol";

import "hardhat/console.sol";

/**
 * Allow verified users to whitelist themselves on the opening ceremony contract
 *
 * See: https://eips.ethereum.org/EIPS/eip-712
 *
 * Process is:
 *    1. DAO verifies and signs a request off-chain confirming a user has completed the quest
 *    2. User then submits a request to be verified, along with the signed request
 *    3. If the request to verify matches the signed request, and the request was signed by the DAO, the user can
 *       whitelist themselves.
 */
contract VerifyQuest is EIP712, Ownable {
    using Counters for Counters.Counter;

    mapping(address => Counters.Counter) private _nonces;
    OpeningCeremony public openingCeremony;
    address public verifier;

    // solhint-disable-next-line var-name-mixedcase
    bytes32 public immutable VERIFY_TYPEHASH = keccak256("Verify(address quester,uint256 nonce)");

    /**
     * Initializes the {EIP712} domain separator and setting `version` to `"1"`.
     */
    constructor(
        OpeningCeremony _openingCeremony,
        address _verifier
      ) EIP712("VerifyQuest", "1") { 

      openingCeremony = _openingCeremony;
      verifier = _verifier;
    }

    function setVerifier(address _verifier) external onlyOwner {
      verifier = _verifier;
    }

    /**
     * If verified, add as a verified user to the OpeningCeremony
     */
    function verify(uint8 v, bytes32 r, bytes32 s) external {
      bytes32 structHash = keccak256(abi.encode(VERIFY_TYPEHASH, msg.sender, _useNonce(msg.sender)));
      bytes32 digest = _hashTypedDataV4(structHash);
      address signer = ECDSA.recover(digest, v, r, s);

      require(signer == verifier, "invalid signature");

      openingCeremony.addVerifiedUser(msg.sender);
    }

    /**
     * Generate a digest (to be signed off-chain by the verified private key)
     */
    function digestFor(address quester) public view returns(bytes32 digest) {
      bytes32 structHash = keccak256(abi.encode(VERIFY_TYPEHASH, quester, nonces(quester)));
      digest = _hashTypedDataV4(structHash);
    }

    /**
     * Current nonce for an given 
     */
    function nonces(address user) public view returns (uint256) {
        return _nonces[user].current();
    }

    /**
     * @dev See {IERC20Permit-DOMAIN_SEPARATOR}.
     */
    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @dev "Consume a nonce": return the current value and increment.
     *
     * _Available since v4.1._
     */
    function _useNonce(address user) internal returns (uint256 current) {
        Counters.Counter storage nonce = _nonces[user];
        current = nonce.current();
        nonce.increment();
    }
}
