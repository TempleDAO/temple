//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Nonces.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./Templar.sol";

/**
 * @title A contract recording voting in the election of temple elders.
 *
 * @notice
 * The election runs "continuously" - timing for when the results are actually
 * actioned is handled at the social/policy layer.
 * 
 * Any address can vote by endorsing candidates. However only endorsements from voters
 * who hold temple (aka "token stakeholders") or who are temple team members (aka "impact
 * stakeholders") have vote value.
 *
 * EIP712 structured data signing supports 'gasless voting' via a relay
 */
contract ElderElection is Nonces, AccessControl {

    bytes32 public constant CAN_NOMINATE = keccak256("CAN_NOMINATE");

    using SafeERC20 for IERC20;

    /// @notice The NFT ids (ie discord ids) of the Templars that are candidates for
    /// the ElderElection
    mapping(uint256 => bool) public candidates;

    /// @notice The number of active candidates
    uint256 public numCandidates;

    /// @notice endorsements by a given voter
    mapping(address => uint256[]) public endorsementsBy;

    /// @notice the NFT contract for templars
    Templar public templars;

    /// @notice used for relayed signed requests
    bytes32 immutable DOMAIN_SEPARATOR;

    event UpdateNomination(uint256 indexed discordId, bool isNominated);
    event UpdateEndorsements(address indexed account, uint256[] discordIds);

    error NotFromTemplar(address account, uint256 discordId);
    error NotCandidate(uint256 discordId);
    error TooManyEndorsements();

    error DeadlineExpired(uint256 lateBy);
    error InvalidNonce(address account);
    error InvalidSignature(address account);

    constructor(
        Templar _templars
    ) {
        templars = _templars;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        DOMAIN_SEPARATOR = hash(EIP712Domain({
            name: "ElderElection",
            version: '1',
            chainId: block.chainid
        }));
    }


    /**
     * @notice Nominate the given discord ID a candidate.
     */
    function nominate(uint256 discordId) external onlyRole(CAN_NOMINATE) {
        templars.checkExists(discordId);

        if (!candidates[discordId]) {
          candidates[discordId] = true;
          numCandidates += 1;
          emit UpdateNomination(discordId, true);
        }
    }

    /**
     * @notice Remove the given discord ID as a candidate
     */
    function resign(uint256 discordId) external onlyRole(CAN_NOMINATE) {
        templars.checkExists(discordId);

        if (candidates[discordId]) {
          candidates[discordId] = false;
          numCandidates -= 1;
          emit UpdateNomination(discordId, false);
        }
    }

    function setEndorsements(uint256[] calldata discordIds) external {
        _setEndorsements(msg.sender, discordIds);
    }

    function _setEndorsements(address account, uint256[] calldata discordIds) internal {
        if (discordIds.length > numCandidates) {
          revert TooManyEndorsements();
        }

        endorsementsBy[account] = discordIds;
        emit UpdateEndorsements(account, discordIds);
    }

    /**
     * @notice Set the endorsements for an account via relayed, signed request. 
     */
    function relayedSetEndorsementsFor(EndorsementReq calldata req, bytes calldata signature) external {

        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            DOMAIN_SEPARATOR,
            hash(req)
        ));

        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signature);
        if (err != ECDSA.RecoverError.NoError) {
            revert InvalidSignature(req.account);
        }
        if (block.timestamp > req.deadline) revert DeadlineExpired(block.timestamp - req.deadline);
        if (signer != req.account) revert InvalidSignature(req.account);
        if (_useNonce(req.account) != req.nonce) revert InvalidNonce(req.account);

        _setEndorsements(req.account, req.discordIds);
    }

    struct EIP712Domain {
        string name;
        string version;
        uint256 chainId;
    }

    bytes32 constant EIP712DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId)");

    function hash(EIP712Domain memory _input) internal pure returns (bytes32) {    
        return keccak256(abi.encode(
            EIP712DOMAIN_TYPEHASH,
            keccak256(bytes(_input.name)),
            keccak256(bytes(_input.version)),
            _input.chainId
        ));
    }

    struct EndorsementReq {
        address account;
        uint256[] discordIds;
        uint256 deadline;
        uint256 nonce;
    }

    bytes32 constant ENDORSEMENTREQ_TYPEHASH = keccak256("EndorsementReq(address account,uint256[] discordIds,uint256 deadline,uint256 nonce)");

    function hash(EndorsementReq memory _input) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            ENDORSEMENTREQ_TYPEHASH,
            _input.account,
            hash(_input.discordIds),
            _input.deadline,
            _input.nonce
        ));
    }

    function hash(uint256[] memory _input) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_input));
    }

}
