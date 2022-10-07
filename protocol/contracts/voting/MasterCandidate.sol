//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";

/**
 * @title an NFT for each master candidate, with associated endorsements
 * 
 * @notice Captures key aspects of temple governance on chain. Namely
 * 
 *   - Anyone in temple discord with at least the Templar Role + verified
 *     wallet can nominate themselves for candidacy.
 *   - Any user can endorse candidates
 *   - EIP712 structured data signing to allow 'gasless voting' via a relay
 * 
 * Which masters are currently voted in/active in the multisig etc is handled
 * at the social layer.
 */
contract MasterCandidate is ERC721, Ownable, EIP712 {
    using Strings for uint256;
    using Counters for Counters.Counter;

    bytes32 public immutable TOGGLE_ENDORSEMENTS_FOR_TYPEHASH = keccak256("toggleEndorsementsFor(address account, uint256[] discordIds, uint256 deadline, uint256 nonce)");
    mapping(address => Counters.Counter) public _nonces;

    /// @notice endorsements per nomination
    mapping(address => mapping (uint256 => bool)) public endorsementsBy;

    /// @dev merkle tree root of (address, claimShare)
    bytes32 public merkleRoot;

    /// @notice Token which nomination fee is charged in
    IERC20 public immutable nominationFeeToken;

    /// @notice Nomination fee amount (in feeToken)
    uint256 public nominationFee;

    /// @notice metadata per nomination
    mapping(uint256 => Candidate) public candidates;

    struct Candidate {
        /// @notice candidate discord id
        uint256 discordId;

        /// @notice Discord handle (static, so if changed in discord needs to be manually updated)
        string discordHandle;

        /// @notice twitter handle (static, so if changed, needs to be manually updated)
        string twitterHandle;
    }

    constructor(
        IERC20 _nominationFeeToken,
        uint256 _nominationFee
    ) ERC721("Temple Master Candidate", "MASTER CANDIDATE") EIP712(name(), "1") {
        nominationFeeToken = _nominationFeeToken;
        nominationFee = _nominationFee;
    }

    /**
     * @dev Change the nomination fee
     * 
     * Designed to be low, but a defense in depth to stop peeps putting up a nomination
     * for the lolz.
     */
    function setNominationFee(uint256 _nominationFee) external onlyOwner {
        nominationFee = _nominationFee;
    }

    /**
     * @dev periodically update the merkle tree root to match discord membership.
     * NOTE: If a user has already minted their 'master candidate' NFT, this doesn't
     * remove it for them.
     * 
     * The voting UI only shows candidates in the intersection of the set
     * MasterCandidate NFT and Discord Users.
     */
    function updateMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
        merkleRoot = _merkleRoot;
    }

    function nominate(
        address account,
        uint256 discordId,
        string memory discordHandle,
        string memory twitterHandle,
        bytes32[] calldata merkleProof
    ) external {
        require(account != address(0), "MasterCandidate: Address cannot be 0x0");
        require(MerkleProof.verify(merkleProof, merkleRoot, keccak256(abi.encode(account, discordId.toString()))), "MasterCandidate: candidate not in temple discord");

        SafeERC20.safeTransferFrom(nominationFeeToken, account, address(this), nominationFee);
        _safeMint(account, discordId);

        Candidate storage candidate = candidates[discordId];
        candidate.discordId = discordId;
        candidate.discordHandle = discordHandle;
        candidate.twitterHandle = twitterHandle;

        emit UpdateMetadata(msg.sender, discordId, discordHandle, twitterHandle);
    }

    function updateMetadata(
        uint256 discordId,
        string memory discordHandle,
        string memory twitterHandle
    ) external {
        require(ownerOf(discordId) == msg.sender, "Only the candidate can update metadata");
        
        Candidate storage candidate = candidates[discordId];
        candidate.discordHandle = discordHandle;
        candidate.twitterHandle = twitterHandle;

        emit UpdateMetadata(msg.sender, discordId, discordHandle, twitterHandle);
    }

    function toggleEndorsement(uint256 discordId) external {
        _toggleEndorsement(msg.sender, discordId);
    }

    function toggleEndorsements(uint256[] memory discordIds) external {
        _toggleEndorsements(msg.sender, discordIds);
    }

    /**
     * @notice Withdraw for another user (gasless for the vault token holder)
     * (assuming the owner has given authority for the caller to act on their behalf)
     *
     * @dev amount is explicit, to allow use case of partial vault withdrawals
     */
    function toggleEndorsementsFor(address account, uint256[] memory discordIds, uint256 deadline, uint8 v, bytes32 r, bytes32 s) public {
        require(block.timestamp <= deadline, "MasterCandidate: expired deadline");

        bytes32 structHash = keccak256(abi.encode(TOGGLE_ENDORSEMENTS_FOR_TYPEHASH, account, discordIds, deadline, _useNonce(account)));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, v, r, s);

        require(signer == account, "MasterCandidate: invalid signature");

        _toggleEndorsements(account, discordIds);
    }

    function tokenURI(uint256 discordId) public view override returns (string memory) {
        require(_exists(discordId), "ERC721Metadata: URI query for nonexistent token");

        Candidate storage candidate = candidates[discordId];

        // TODO(butlerji): Actually URI encode this somehow?
        return string(abi.encodePacked(candidate.discordHandle, candidate.twitterHandle, discordId.toString()));
    }

    /**
    * See {IERC20Permit-DOMAIN_SEPARATOR}.
    */
    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function _toggleEndorsements(address account, uint256[] memory discordIds) internal {
        for (uint256 i = 0; i < discordIds.length; i++) {
            _toggleEndorsement(account, discordIds[i]);
        }
    }

    function _toggleEndorsement(address account, uint256 discordId) internal {
        require(_exists(discordId), "ElderCandidate: Cannot endorse nonexistent candidate");
        endorsementsBy[account][discordId] = !endorsementsBy[account][discordId];

        emit ToggleEndorsement(account, discordId, endorsementsBy[account][discordId]);
    }

    /**
     * "Consume a nonce": return the current value and increment.
     */
    function _useNonce(address owner) internal returns (uint256 current) {
        Counters.Counter storage nonce = _nonces[owner];
        current = nonce.current();
        nonce.increment();
    }

    event ToggleEndorsement(address account, uint256 discordId, bool isEndorsed);
    event UpdateMetadata(address account, uint256 discordId, string discordHandle, string twitterHandle);
}
