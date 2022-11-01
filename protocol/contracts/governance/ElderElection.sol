//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./Templar.sol";
import "hardhat/console.sol";
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
contract ElderElection is AccessControl {

    bytes32 public constant CAN_NOMINATE = keccak256("CAN_NOMINATE");

    using Counters for Counters.Counter;
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

    /// @notice Nonces used in relayed voting requests
    mapping(address => Counters.Counter) public nonces;

    /// @notice used for relayed signed requests
    bytes32 DOMAIN_SEPARATOR;


    constructor(
        Templar _templars
    ) {
        templars = _templars;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        DOMAIN_SEPARATOR = hash(EIP712Domain({
            name: "ElderElection",
            version: '1',
            chainId: 1
        }));
   //     console.log("DOMAIN_SEPARATOR");
   //     console.logBytes32(DOMAIN_SEPARATOR);
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

    function _setEndorsements(address account, uint256[] memory discordIds) internal {
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

       // console.log("digest");
       // console.logBytes32(digest);

        address signer = recover(digest, signature);
        if (signer == address(0)) {
            console.log("no recovered signer");
            revert InvalidSignature(req.account);
        }
        //console.log("recovered signer ", signer);
        //console.log("req.account", req.account);

        if (block.timestamp > req.deadline) revert DeadlineExpired(block.timestamp - req.deadline);
        if (signer != req.account) revert InvalidSignature(req.account);

         uint256[] memory discordIds = new uint256[](1);
         discordIds[0] = req.discordId;
        _setEndorsements(req.account, discordIds);
    }

    function recover(bytes32 hash, bytes memory sig) internal view returns (address) {
        bytes32 r;
        bytes32 s;
        uint8 v;

        // console.log("sig");
        // console.logBytes(sig);


        //Check the signature length
        if (sig.length != 65) {
            return (address(0));
        }


        // Divide the signature in r, s and v variables
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }

        // console.log("signature.r");
        // console.logBytes32(r);
        // console.log("signature.s");
        // console.logBytes32(s);
        // console.log("signature.v");
        // console.logBytes1(bytes1(v));

        // Version of signature should be 27 or 28, but 0 and 1 are also possible versions
        if (v < 27) {
            v += 27;
        }

        // If the version is correct return the signer address
        if (v != 27 && v != 28) {
            return (address(0));
        } else {
            return ecrecover(hash, v, r, s);
        }
    }

    /**
     * "Consume a nonce": return the current value and increment.
     */
    function _useNonce(address _owner) internal returns (uint256 current) {
        Counters.Counter storage nonce = nonces[_owner];
        current = nonce.current();
        nonce.increment();
    }

    event UpdateNomination(uint256 indexed discordId, bool isNominated);
    event UpdateEndorsements(address indexed account, uint256[] discordIds);

    error NotFromTemplar(address account, uint256 discordId);
    error NotCandidate(uint256 discordId);
    error TooManyEndorsements();

    error DeadlineExpired(uint256 lateBy);
    error InvalidSignature(address account);
    
    struct EIP712Domain {
        string name;
        string version;
        uint256 chainId;
    }

    bytes32 constant EIP712DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId)");

    function hash(EIP712Domain memory _input) public pure returns (bytes32) {    
        return keccak256(abi.encode(
            EIP712DOMAIN_TYPEHASH,
            keccak256(bytes(_input.name)),
            keccak256(bytes(_input.version)),
            _input.chainId
        ));
    }

    struct EndorsementReq {
        address account;
        uint256 discordId;
        uint256 deadline;
    }

    bytes32 constant ENDORSEMENTREQ_TYPEHASH = keccak256("EndorsementReq(address account,uint256 discordId,uint256 deadline)");

    function hash(EndorsementReq memory _input) public view returns (bytes32) {
        return keccak256(abi.encode(
            ENDORSEMENTREQ_TYPEHASH,
            _input.account,
            _input.discordId,
            _input.deadline
        ));
    }

}
