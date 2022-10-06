//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

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

    /// @notice Next unused tokenId
    Counters.Counter public nextTokenId;

    /// @notice endorsements per nomination
    mapping(address => mapping (uint256 => bool)) public endorsementsBy;

    /// @notice metadata per nomination
    mapping(uint256 => Candidate) public candidates;

    /// @notice Token in which stake is stored per canidate
    IERC20 public immutable stakedToken;

    /// @notice Token in which stake is stored per canidate
    uint256 public immutable stakePerCandidate = 1000 * 1e18;

    struct Candidate {
        string name;
        string discordHandle;
        string twitterHandle;
        uint256 endorsements;
    }

    constructor(
        IERC20 _stakedToken
    ) ERC721("Temple Elder Candidate", "ELDER CANDIDATE") {
        nextTokenId.increment();
        stakedToken = _stakedToken;
    }

    function nominateCandidate(
        string memory name,
        string memory discordHandle,
        string memory twitterHandle,
        address owner
    ) external {
        uint256 tokenId = nextTokenId.current();
        nextTokenId.increment();
        SafeERC20.safeTransferFrom(stakedToken, msg.sender, address(this), stakePerCandidate);

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
        require(ownerOf(tokenId) == msg.sender || owner() == msg.sender, "Only the candidate or the owner can remove a nomination");

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

    /**
    * @dev transfer out amount of token to provided address. Escape hatch in the event an incorrect
    * contract is deployed.
    */
    function withdraw(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "to address zero");

        if (token == address(0)) {
            (bool sent,) = payable(to).call{value: amount}("");
            require(sent, "send failed");
        } else {
            SafeERC20.safeTransfer(IERC20(token), to, amount);
        }
    }
}
