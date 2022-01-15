pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/*
    Claim allocated $TEMPLE or other currencies with a verified signature
*/
contract TempleCashback is EIP712, Ownable {
    using ECDSA for bytes32;

    event Withdrawal(
        address indexed tokenAddress,
        address indexed recipient,
        uint256 indexed tokenQuantity
    );

    address public verifier;
    mapping(address => mapping(uint256 => bool)) public usedNonces;
    bytes32 public immutable VERIFY_TYPEHASH =
        keccak256(
            "Claim(address tokenAddress,address recipient,uint256 tokenQuantity,uint256 nonce)"
        );

    constructor(address _verifier) EIP712("TempleCashback", "1") {
        verifier = _verifier;
    }

    function setVerifier(address _verifier) external onlyOwner {
        verifier = _verifier;
    }

    function withdraw(address tokenAddress, uint256 tokenQuantity)
        public
        virtual
        onlyOwner
    {
        IERC20(tokenAddress).transfer(msg.sender, tokenQuantity);
    }

    function _matchVerifier(bytes32 hash, bytes memory signature)
        private
        view
        returns (bool)
    {
        return verifier == hash.recover(signature);
    }

    function generateHash(
        address tokenAddress,
        address recipient,
        uint256 tokenQuantity,
        uint256 nonce
    ) public view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        VERIFY_TYPEHASH,
                        tokenAddress,
                        recipient,
                        tokenQuantity,
                        nonce
                    )
                )
            );
    }

    function claim(
        bytes32 hash,
        bytes memory signature,
        address tokenAddress,
        uint256 tokenQuantity,
        uint256 nonce
    ) external payable {
        require(tokenQuantity > 0, "No funds allocated");
        require(!usedNonces[msg.sender][nonce], "Hash used");
        require(_matchVerifier(hash, signature), "Invalid signature");
        require(
            generateHash(tokenAddress, msg.sender, tokenQuantity, nonce) ==
                hash,
            "Hash fail"
        );
        usedNonces[msg.sender][nonce] = true;
        IERC20(tokenAddress).transfer(msg.sender, tokenQuantity);
        emit Withdrawal(tokenAddress, msg.sender, tokenQuantity);
    }
}
