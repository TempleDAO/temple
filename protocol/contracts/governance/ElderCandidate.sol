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
 * @title an NFT for each elder candidate, with associated endorsements
 * 
 * @notice Captures key aspects of temple governance on chain. Namely
 * 
 *   - Anyone in temple discord with at least the Templar Role + verified
 *     wallet can nominate themselves for candidacy.
 *   - Any user can endorse candidates
 *   - EIP712 structured data signing to allow 'gasless voting' via a relay
 * 
 * Which elders are currently voted in and responsible for approving proposals is handled
 * at the social layer.
 */
contract ElderCandidate is ERC721, Ownable, EIP712 {
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

    constructor(
        IERC20 _nominationFeeToken,
        uint256 _nominationFee
    ) ERC721("Temple Elder Candidate", "ELDER CANDIDATE") EIP712(name(), "1") {
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
     * NOTE: If a user has already minted their 'elder candidate' NFT, this doesn't
     * remove it for them.
     */
    //TODO(butlerji): Should we make this 'manager' - as I can imagine an endstate where this is
    // auto-updated from the dao games backend server.
    function updateMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
        merkleRoot = _merkleRoot;
    }

    // TODO(butlerji): Confirm if merkleProof is 0x0, no candidate can be added
    // TODO(butlerji): Confirm a fee of 0 works
    // TODO(butlerji>nicho): The voting UI should only shows candidates in the intersection of the set
    //                       ElderCandidate NFT and active Discord Users (post MVP/to be discussed)
    /**
     * Enable the given discord ID as a candidate.
     */
    // NOTE(butlerji): For MVP, we'll create a small merkle tree with *just* the people who requested nomination on discord
    //                 We can generalise later with an merkle root for everyone in discord + a nominal fee to stop spamming
    //                 nominations for the lolz
    function nominate(
        address account,
        uint256 discordId,
        bytes32[] calldata merkleProof
    ) external {
        require(account != address(0), "MasterCandidate: Address cannot be 0x0");
        require(MerkleProof.verify(merkleProof, merkleRoot, keccak256(abi.encode(account, discordId.toString()))), "MasterCandidate: candidate not in temple discord");

        SafeERC20.safeTransferFrom(nominationFeeToken, account, address(this), nominationFee);
        _safeMint(account, discordId);
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
    // TODO(butlerji): Need to test this works. The idea is I'd sign a message on mainnet, which gets sent to our backend, then sent to 
    //                 the mempool on whatever L2 we are running this on.
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

        // TODO(butlerji): What should this be? Ideally something that resolves for all time?
        //                 IMHO I'd be fine with an encoded json of the shape {discordId: number}
        return string(abi.encodePacked(discordId.toString()));
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
}
