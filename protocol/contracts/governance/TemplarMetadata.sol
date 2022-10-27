//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./Templar.sol";

/**
 * @title a contract recording the metadata for templars (ie roles etc).
 */
contract TemplarMetadata is AccessControl {

    bytes32 public constant CAN_UPDATE = keccak256("CAN_UPDATE");

     // Mapping from discordId ID to max temple role
    mapping(uint256 => string) public templeRole;

    /// @notice the NFT contract for templars
    Templar public templars;

    constructor(Templar _templars) {
        templars = _templars;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * Set the (highest) temple role held by a templar with the given discordid
     */
    function setRole( 
        uint256 discordId,
        string calldata _templeRole
    ) external onlyRole(CAN_UPDATE) {
        templars.checkExists(discordId);

        if (keccak256(abi.encodePacked(templeRole[discordId])) != keccak256(abi.encodePacked(_templeRole))) {
            templeRole[discordId] = _templeRole;
            emit UpdateTempleRole(discordId, _templeRole);
        }
    }

    event UpdateTempleRole(uint256 indexed discordId, string templeRole);
}
