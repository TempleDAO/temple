// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
// Temple (v2/SafeGuards/SafeForked.sol)

import { GnosisSafe } from "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import { ISignatureValidator } from "@gnosis.pm/safe-contracts/contracts/interfaces/ISignatureValidator.sol";

// Ideally this isn't required. 
// See: https://github.com/safe-global/safe-contracts/pull/557
//      https://forum.safe.global/t/safe-contract-v1-5-0/3383
library SafeForked {

    // Cloned from ISignatureValidatorConstants
    // bytes4(keccak256("isValidSignature(bytes,bytes)")
    bytes4 internal constant EIP1271_MAGIC_VALUE = 0x20c13b0b;

    // Cloned from SignatureDecoder
    function signatureSplit(bytes memory signatures, uint256 pos) internal pure returns (uint8 v, bytes32 r, bytes32 s) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let signaturePos := mul(0x41, pos)
            r := mload(add(signatures, add(signaturePos, 0x20)))
            s := mload(add(signatures, add(signaturePos, 0x40)))
            /**
             * Here we are loading the last 32 bytes, including 31 bytes
             * of 's'. There is no 'mload8' to do this.
             * 'byte' is not working due to the Solidity parser, so lets
             * use the second best option, 'and'
             */
            v := and(mload(add(signatures, add(signaturePos, 0x41))), 0xff)
        }
    }

    // Forked from Safe
    // The only addition is to pass through the executor, and to throw a more descriptive error if the number of signatories doesn't match.
    function checkNSignatures(address executor, GnosisSafe safe, bytes32 dataHash, bytes memory data, bytes memory signatures, uint256 requiredSignatures) internal view {
        // Check that the provided signature data is not too short
        // Left as a revert string so it shows in the Safe UI, and made more descriptive.
        require(signatures.length >= requiredSignatures * 65, "!Dynamic Signature Threshold");

        // There cannot be an owner with address 0.
        address lastOwner = address(0);
        address currentOwner;
        uint8 v;
        bytes32 r;
        bytes32 s;
        uint256 i;
        for (i = 0; i < requiredSignatures; i++) {
            (v, r, s) = signatureSplit(signatures, i);
            if (v == 0) {
                require(keccak256(data) == dataHash, "GS027");
                // If v is 0 then it is a contract signature
                // When handling contract signatures the address of the contract is encoded into r
                currentOwner = address(uint160(uint256(r)));

                // Check that signature data pointer (s) is not pointing inside the static part of the signatures bytes
                // This check is not completely accurate, since it is possible that more signatures than the threshold are send.
                // Here we only check that the pointer is not pointing inside the part that is being processed
                require(uint256(s) >= (requiredSignatures * 65), "GS021");

                // Check that signature data pointer (s) is in bounds (points to the length of data -> 32 bytes)
                require((uint256(s) + 32) <= signatures.length, "GS022");

                // Check if the contract signature is in bounds: start of data is s + 32 and end is start + signature length
                uint256 contractSignatureLen;
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    contractSignatureLen := mload(add(add(signatures, s), 0x20))
                }
                require((uint256(s) + 32 + contractSignatureLen) <= signatures.length, "GS023");

                // Check signature
                bytes memory contractSignature;
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    // The signature data for contract signatures is appended to the concatenated signatures and the offset is stored in s
                    contractSignature := add(add(signatures, s), 0x20)
                }
                require(ISignatureValidator(currentOwner).isValidSignature(data, contractSignature) == EIP1271_MAGIC_VALUE, "GS024");
            } else if (v == 1) {
                // If v is 1 then it is an approved hash
                // When handling approved hashes the address of the approver is encoded into r
                currentOwner = address(uint160(uint256(r)));
                // Hashes are automatically approved by the sender of the message or when they have been pre-approved via a separate transaction
                require(executor == currentOwner || safe.approvedHashes(currentOwner, dataHash) != 0, "GS025");
            } else if (v > 30) {
                // If v > 30 then default va (27,28) has been adjusted for eth_sign flow
                // To support eth_sign and similar we adjust v and hash the messageHash with the Ethereum message prefix before applying ecrecover
                currentOwner = ecrecover(keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", dataHash)), v - 4, r, s);
            } else {
                // Default is the ecrecover flow with the provided data hash
                // Use ecrecover with the messageHash for EOA signatures
                currentOwner = ecrecover(dataHash, v, r, s);
            }
            require(currentOwner > lastOwner && safe.isOwner(currentOwner), "GS026");
            lastOwner = currentOwner;
        }
    }
}