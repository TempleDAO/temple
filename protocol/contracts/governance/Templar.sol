//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title an NFT representing membership in the temple community.
 *
 * It exists as on chain proof that 
 */
contract Templar is ERC721, Ownable {

    // Claims for discord ids must be signed by this address.
    address public claimSigner;

    constructor(address _claimSigner) ERC721("Templar", "TEMPLAR") {
        claimSigner = _claimSigner;
    }

    function setClaimSigner(address _claimSigner) external onlyOwner {
        claimSigner = _claimSigner;
    }

    /**
     * Claim the NFT for the specified discord id, delivering it to the specified
     * address. They caller must show they own the id by providing an appropriate
     * signature from the claimSigner.
     * 
     * This will either mint the NFT (if it doesn't exist), or transfer it.
     *
     * This method will be called by the discord bot when it is DM'd with a
     * request of the form:
                         /!claim_gov_nft <ADDR>
     */
    function claim(
        address account,
        DiscordClaim calldata dclaim,
        bytes calldata signature
    ) external {
        if (account == address(0)) revert InvalidAddress(account);

        (address signer, ECDSA.RecoverError err)  = ECDSA.tryRecover(hashDiscordClaim(dclaim), signature);
        if (err != ECDSA.RecoverError.NoError) {
            revert InvalidClaim(dclaim.discordId);
        }
        if (signer != claimSigner) revert InvalidClaim(dclaim.discordId);

        if (_exists(dclaim.discordId)) {
            _transfer(ownerOf(dclaim.discordId), account, dclaim.discordId);

        } else {
            _safeMint(account, dclaim.discordId);
        }
    }

    struct DiscordClaim {
        uint256 discordId;
    }

    string private constant DISCORD_CLAIM_TYPE = "DiscordClaim(uint256 discordId)";
    bytes32 private constant DISCORD_CLAIM_TYPEHASH = keccak256(abi.encodePacked(DISCORD_CLAIM_TYPE));

    function hashDiscordClaim(DiscordClaim memory dclaim) private pure returns (bytes32) {
        return keccak256(abi.encode(
            DISCORD_CLAIM_TYPEHASH,
            dclaim.discordId
        ));
    }

    function tokenURI(uint256 discordId) public pure override returns (string memory) {
        return string.concat("https://discordapp.com/users/", Strings.toString(discordId));
    }

    error InvalidAddress(address addr);
    error InvalidClaim(uint256 discordId);
}
