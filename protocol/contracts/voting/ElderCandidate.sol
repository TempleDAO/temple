//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title Track Elder candidates and endorsements.
 * 
 * @notice Capture votes for temple elders on chain, allows those who are
 * 
 *   - Add their nomination
 *   - Endorse candidates
 */
contract ElderCandidate is ERC721 {
    using Strings for uint256;
    using Counters for Counters.Counter;

    /// @notice Next unused tokenId
    Counters.Counter public nextTokenId;

    /// @notice endorsements per nomination
    mapping(address => mapping (uint256 => bool)) public endorsementsBy;

    /// @notice metadata per nomination
    mapping(uint256 => Candidate) public candidates;

    struct Candidate {
        string name;
        string discordHandle;
        string twitterHandle;
        uint256 endorsements;
    }

    constructor() ERC721("Temple Elder Candidate", "ELDER CANDIDATE") {
        nextTokenId.increment();
    }

    function nominateCandidate(
        string memory name,
        string memory discordHandle,
        string memory twitterHandle,
        address owner
    ) external {
        uint256 tokenId = nextTokenId.current();
        nextTokenId.increment();

        _safeMint(owner, tokenId);

        Candidate storage candidate = candidates[tokenId];
        candidate.name = name;
        candidate.discordHandle = discordHandle;
        candidate.twitterHandle = twitterHandle;
    }

    function updateCandidateMetadata(
        uint256 tokenId,
        string memory name,
        string memory discordHandle,
        string memory twitterHandle
    ) external {
        require(ownerOf(tokenId) == msg.sender, "Only the candidate can update metadata");
        
        Candidate storage candidate = candidates[tokenId];
        candidate.name = name;
        candidate.discordHandle = discordHandle;
        candidate.twitterHandle = twitterHandle;
    }

    function removeNomination(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Only the candidate can remove their nomination");

        delete candidates[tokenId];
        _burn(tokenId);
    }

    function toggleEndorsement(uint256 tokenId) external {
        require(_exists(tokenId), "ElderCandidate: Cannot endorse nonexistent candidate");

        if (endorsementsBy[msg.sender][tokenId]) {
            candidates[tokenId].endorsements -= 1;
        } else {
            candidates[tokenId].endorsements += 1;
        }
        endorsementsBy[msg.sender][tokenId] = !endorsementsBy[msg.sender][tokenId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");

        Candidate storage candidate = candidates[tokenId];

        // TODO(butlerji): Actually URI encode this somehow?
        return string(abi.encodePacked(candidate.name, candidate.discordHandle, candidate.twitterHandle, tokenId.toString()));
    }
}
