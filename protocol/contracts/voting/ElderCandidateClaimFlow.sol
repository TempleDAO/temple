//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title Track Elder candidates and endorsements.
 * 
 * @notice Capture votes for temple elders on chain, allows those who are
 * 
 *   - Add their nomination
 *   - Endorse candidates
 */
contract ElderCandidate is ERC721, Ownable {
    using Strings for uint256;
    using Counters for Counters.Counter;

    /// @notice endorsements per nomination
    mapping(address => mapping (uint256 => bool)) public endorsementsBy;

    /// @notice metadata per nomination
    mapping(uint256 => Candidate) public candidates;

    /// @dev merkle tree root of (address, claimShare)
    bytes32 public merkleRoot;

    struct Candidate {
        string discordHandle;
        string twitterHandle;
        uint256 endorsements;
    }

    constructor() ERC721("Temple Elder Candidate", "ELDER CANDIDATE") {
    }

    function claimCandidate(
        address account,
        uint256 discordId,
        string memory discordHandle,
        string memory twitterHandle,
        bytes32[] calldata merkleProof
    ) external {
        require(account != address(0), "MerkleTreeClaim: Address cannot be 0x0");
        require(MerkleProof.verify(merkleProof, merkleRoot, keccak256(abi.encode(account, discordId.toString()))), "Invalid claim");

        _safeMint(owner, discordId);

        Candidate storage candidate = candidates[discordId];
        candidate.name = name;
        candidate.discordId = discordId;
        candidate.discordHandle = discordHandle;
        candidate.twitterHandle = twitterHandle;
    }

    function updateCandidateMetadata(
        uint256 discordId,
        string memory name,
        string memory discordHandle,
        string memory twitterHandle
    ) external {
        require(ownerOf(discordId) == msg.sender, "Only the candidate can update metadata");
        
        Candidate storage candidate = candidates[discordId];
        candidate.name = name;
        candidate.discordHandle = discordHandle;
        candidate.twitterHandle = twitterHandle;
    }

    function updateMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
        merkleRoot = _merkleRoot;
    }

    function toggleEndorsement(uint256 discordId) external {
        require(_exists(discordId), "ElderCandidate: Cannot endorse nonexistent candidate");

        if (endorsementsBy[msg.sender][discordId]) {
            candidates[discordId].endorsements -= 1;
        } else {
            candidates[discordId].endorsements += 1;
        }
        endorsementsBy[msg.sender][discordId] = !endorsementsBy[msg.sender][discordId];
    }

    function tokenURI(uint256 discordId) public view override returns (string memory) {
        require(_exists(discordId), "ERC721Metadata: URI query for nonexistent token");

        Candidate storage candidate = candidates[discordId];

        // TODO(butlerji): Actually URI encode this somehow?
        return string(abi.encodePacked(candidate.name, candidate.discordHandle, candidate.twitterHandle, discordId.toString()));
    }
}
