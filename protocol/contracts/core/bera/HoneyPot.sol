pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

error AlreadyMinted();
error InvalidSignature();
error NonTransferrable();

/**
 * @title HoneyPost Mint Shard Pass
 *
 * @dev Gives Puzzle solvers whitelist to enter the honey pot vault
 *
 */
contract HoneyPot is ERC721, EIP712, Ownable, Pausable {

    using Counters for Counters.Counter;

    address public verifier;
    mapping(address => bool) public minted;

    Counters.Counter private _tokenIdTracker;

    bytes32 public immutable VERIFY_TYPEHASH = keccak256("mint(address account)");

 
    constructor(
        string memory _name,
        string memory _symbol,
        address _verifier
    ) ERC721(_name, _symbol) EIP712(_name, "1") {
        verifier = _verifier;
    }


    function setVerifier(address _verifier) external onlyOwner {
        verifier = _verifier;
        emit SetVerifier(verifier);
    }

    /**
     * @dev Pause minting of tokens
     *
     *  Requirements:
     *  caller must be admin
     */
    function pause() external onlyOwner {
         _pause();
    }

    /**
     * @dev UnPause minting of tokens
     *
     *  Requirements:
     *  caller must be admin
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    

    /**
     * @dev Creates a new token for `msg.sender`. Its token ID will be automatically
     * assigned. 
     *
     * Requirements:
     *
     * - User must have completed pussle and got a signature of completion from dapp
     */
    function mint(uint8 v, bytes32 r, bytes32 s) public virtual whenNotPaused {

      if (minted[msg.sender]) {
          revert AlreadyMinted();
      }

      bytes32 structHash = keccak256(abi.encode(VERIFY_TYPEHASH, msg.sender));
      bytes32 digest = _hashTypedDataV4(structHash);
      address signer = ECDSA.recover(digest, v, r, s);

      if (signer != verifier) {
          revert InvalidSignature();
      }
      _mint(msg.sender, _tokenIdTracker.current());
      _tokenIdTracker.increment();

      minted[msg.sender] = true;
    }


    /**
     * Generate a digest (to be signed off-chain by the verified private key)
     */
    function digestFor(address account) public view returns(bytes32 digest) {
      bytes32 structHash = keccak256(abi.encode(VERIFY_TYPEHASH, account));
      digest = _hashTypedDataV4(structHash);
    }


    /**
     * @dev See {IERC20Permit-DOMAIN_SEPARATOR}.
     */
    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @dev See {ERC721-_beforeTokenTransfer}.
     *
     * Requirements:
     *
     * - token is non-transferable. Only mint and burn allowed
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, tokenId);
        if (from != address(0) && to != address(0)) {
            revert NonTransferrable();
        }
    }

    event SetVerifier(address verifier);
    
}