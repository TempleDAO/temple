pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/nexus/ITempleSacrifice.sol)


interface ITempleSacrifice {

    /*
     * @notice Set sacrificed temple recipient.
     * @param recipient Recipient
     */
    function setSacrificedTokenRecipient(address recipient) external;
}