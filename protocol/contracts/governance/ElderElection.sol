//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";

/**
 * @title A contract recording voting in the election of temple elders.
 *
 * @notice
 * The election runs "continuously" - timing for when the results are actually
 * actioned is handled at the social layer.
 * 
 * Any address can vote by endorsing candidates. However endorsements from voters
 * who hold staked temple or who are temple team members carry have vote value.
 *
 * EIP712 structured data signing supports 'gasless voting' via a relay
 */
contract ElderElection is Ownable, EIP712 {
    using Counters for Counters.Counter;
    using SafeERC20 for IERC20;

    /// @notice The NFT ids of the Templars thar are candidates for the ElderElection
    mapping(uint256 => bool) public candidates;

    /// @notice endorsements by a given voter
    mapping(address => uint256[]) public endorsementsBy;

    /// @notice the NFT contract for templars
    ERC721 public templars;

    /// @notice Token which nomination fee is charged in
    IERC20 public immutable nominationFeeToken;

    /// @notice Nomination fee amount (in feeToken)
    uint256 public nominationFee;

    /// @notice root hash of off-chain merkle tree recording
    /// temple roles ie :(discordId, maxTempleRole)
    bytes32 public templarRolesMerkleRoot;

    /// @notice Nonces used in relayed voting requests
    mapping(address => Counters.Counter) public _nonces;


    constructor(
        ERC721 _templars,
        IERC20 _nominationFeeToken,
        uint256 _nominationFee
    ) EIP712("ElderElection", "1") {
        templars = _templars;
        nominationFeeToken = _nominationFeeToken;
        nominationFee = _nominationFee;
    }

    /**
     * @notice Change the nomination fee
     * 
     * Designed to be low, but a defense in depth to stop peeps putting up a nomination
     * for the lolz.
     */
    function setNominationFee(uint256 _nominationFee) external onlyOwner {
        nominationFee = _nominationFee;
    }

    /**
     * @notice Update the merkle tree root for temple roles.
     */
    function setTemplarRolesMerklRoot(bytes32 _templarRolesMerkleRoot) external onlyOwner {
        templarRolesMerkleRoot = _templarRolesMerkleRoot;
    }

    /**
     * @notice Nominate the given discord ID a candidate.
     * @dev The given address must hold the NFT for the specified discord id
     */
    function nominate(
        address account,
        uint256 discordId
    ) external {
        if (templars.ownerOf(discordId) != account) {
            revert NotFromTemplar(account, discordId);
        }

        if (!candidates[discordId]) {

          if (nominationFee > 0) {
              nominationFeeToken.safeTransferFrom(account, address(this), nominationFee);
          }
          candidates[discordId] = true;
          emit UpdateNomination(discordId, candidates[discordId]);
        }
    }

    /**
     * @notice Remove the given discord ID as a candidate
     * @dev The given address must hold the NFT for the specified discord id
     */
    function resign(
        address account,
        uint256 discordId
    ) external {
        if (templars.ownerOf(discordId) != account) {
            revert NotFromTemplar(account, discordId);
        }

        if (candidates[discordId]) {
          candidates[discordId] = false;
          emit UpdateNomination(discordId, candidates[discordId]);
        }
    }

    function setEndorsements(uint256[] memory discordIds) external {
        _setEndorsements(msg.sender, discordIds);
    }

    function _setEndorsements(address account, uint256[] memory discordIds) internal {
        endorsementsBy[account] = discordIds;
        emit UpdateEndorsements(account, discordIds);
    }

    /**
     * @notice Toggle the 
     * (assuming the owner has given authority for the caller to act on their behalf)
     *
     * @dev amount is explicit, to allow use case of partial vault withdrawals
     */
    // TODO(butlerji): Need to test this works. The idea is I'd sign a message on mainnet, which gets sent to our backend, then sent to 
    //                 the mempool on whatever L2 we are running this on.
    function relayedSetEndorsementsFor(address account, uint256[] memory discordIds, uint256 deadline, bytes calldata signature) public {
        if (block.timestamp > deadline) revert DeadlineExpired(deadline);

        bytes32 structHash = keccak256(abi.encode(TOGGLE_ENDORSEMENTS_FOR_TYPEHASH, account, discordIds, deadline, _useNonce(account)));
        bytes32 digest = _hashTypedDataV4(structHash);
        (address signer, ECDSA.RecoverError err) = ECDSA.tryRecover(digest, signature);
        if (err != ECDSA.RecoverError.NoError) {
            revert InvalidSignature(account);
        }
        if (signer != account) revert InvalidSignature(account);

        _setEndorsements(account, discordIds);
    }

    /**
    * See {IERC20Permit-DOMAIN_SEPARATOR}.
    */
    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * "Consume a nonce": return the current value and increment.
     */
    function _useNonce(address _owner) internal returns (uint256 current) {
        Counters.Counter storage nonce = _nonces[_owner];
        current = nonce.current();
        nonce.increment();
    }

    event UpdateNomination(uint256 discordId, bool isNominated);
    event UpdateEndorsements(address account, uint256[] discordId);

    error NotFromTemplar(address account, uint256 discordId);
    error NotCandidate(uint256 discordId);


    error DeadlineExpired(uint256 deadline);
    error InvalidSignature(address account);

    bytes32 public immutable TOGGLE_ENDORSEMENTS_FOR_TYPEHASH = keccak256("toggleEndorsementsFor(address account, uint256[] discordIds, uint256 deadline, uint256 nonce)");
}
