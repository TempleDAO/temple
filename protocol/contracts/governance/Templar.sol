//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title an NFT representing membership in the temple community.
 *
 * It exists as on chain proof that an account owns a discord id.
 */
contract Templar is ERC721, AccessControl {

    bytes32 public constant OWNER = keccak256("OWNER");
    bytes32 public constant CAN_ASSIGN = keccak256("CAN_ASSIGN");

    string public baseUri = "https://discordapp.com/users/";


    constructor() ERC721("Templar", "TEMPLAR") {
        _grantRole(OWNER, msg.sender);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
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
    function setBaseUri(string calldata _baseUri) external onlyRole(OWNER) {
        baseUri = _baseUri;
        emit BaseUriUpdated(baseUri);
    }

    /**
     * Assign the NFT for the specified discord id delivering it to the specified
     * address. 
     * 
     * This will either mint the NFT (if it doesn't exist), or transfer it.
     */
    function assign( 
        address account,
        uint256 discordId
    ) external onlyRole(CAN_ASSIGN) {
        if (account == address(0)) revert InvalidAddress(account);

        if (exists(discordId)) {
            if (ownerOf(discordId) != account) {
                _transfer(ownerOf(discordId), account, discordId);
            }
        } else {
            _safeMint(account, discordId);
        }
    }

    function exists(uint256 discordId) public view returns (bool) {
        return _ownerOf(discordId) != address(0);
    }

    function checkExists(uint256 discordId) public view {
        if (!exists(discordId)) {
            revert InvalidTemplar(discordId);
        }
    }



    function _baseURI() internal view override returns (string memory) {
        return baseUri;
    }

    error InvalidAddress(address addr);
    error InvalidTemplar(uint256 discordId);

    event BaseUriUpdated(string baseUri);
}
