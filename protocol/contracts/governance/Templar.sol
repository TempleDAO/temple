//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title an NFT representing membership in the temple community.
 *
 * It exists as on chain proof that an account owns a discord id.
 */
contract Templar is ERC721, Ownable, AccessControl {

    bytes32 public constant CAN_ASSIGN = keccak256("CAN_ASSIGN");

    string public baseUri = "https://discordapp.com/users/";

     // Mapping from discordId ID to max temple role
    mapping(uint256 => string) public templeRole;

    constructor() ERC721("Templar", "TEMPLAR") {
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return (
            ERC721.supportsInterface(interfaceId) || 
            AccessControl.supportsInterface(interfaceId)
        );
    }

    /**
     *  Update the base URI for tokens.
     */
    function setBaseUri(string calldata _baseUri) external onlyOwner {
        baseUri = _baseUri;
    }

    /**
     * Assign the NFT for the specified discord id delivering it to the specified
     * address. 
     * 
     * This will either mint the NFT (if it doesn't exist), or transfer it.
     *
     * This method will be called by the discord bot when it is DM'd with a
     * request of the form:
                         /!claim_gov_nft <ADDR>
     */
    function assign( 
        address account,
        uint256 discordId,
        string calldata _templeRole
    ) external onlyRole(CAN_ASSIGN) {
        if (account == address(0)) revert InvalidAddress(account);

        if (_exists(discordId)) {
            if (ownerOf(discordId) != account) {
                _transfer(ownerOf(discordId), account, discordId);
            }
        } else {
            _safeMint(account, discordId);
        }

        if (keccak256(abi.encodePacked(templeRole[discordId])) != keccak256(abi.encodePacked(_templeRole))) {
            templeRole[discordId] = _templeRole;
            emit UpdateTempleRole(discordId, _templeRole);
        }
    }

    function checkExists(uint256 discordId) public view {
        if (!_exists(discordId)) {
            revert InvalidTemplar(discordId);
        }
    }

    function getTempleRole(uint256 discordId) public view returns (string memory) {
        return templeRole[discordId];
    }

    function _baseURI() internal view override returns (string memory) {
        return baseUri;
    }

    error InvalidAddress(address addr);
    error InvalidTemplar(uint256 discordId);

    event UpdateTempleRole(uint256 indexed discordId, string templeRole);
}
