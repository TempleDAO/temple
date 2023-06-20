pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/amo/helpers/IRamosTokenVault.sol)

/**
 * @title Ramos token vault store
 *
 * @notice Ramos strategy uses this vault to borrow and repay protocol and quote tokens
 * 
 * Tokens have two generic functions:
 *  1/ Borrow specified tokens from the Protocol Reserve Vault (PRV) to Ramos
 *  2/ Repay the specified tokens from Ramos to the PRV, effectively cancelling the initial
 *     debt acquired by the strategy. Debt can be cancelled in multiple payments. 
 *  
 */
interface IRamosTokenVault {
    /**
     * @notice borrow protocol token from the PRV to the recipient
     * @param amount the requested amount to borrow
     * @param recipient the recipient to send the amount requested to
     */
    function borrowProtocolToken(uint256 amount, address recipient) external;    

    /**
     * @notice borrow quote token from the PRV to the recipient
     * @param amount the requested amount to borrow
     * @param recipient the recipient to send the amount requested to
     */
    function borrowQuoteToken(uint256 amount, address recipient) external;

    /**
     * @notice repay protocol token from the recipient to the PRV
     * @param amount the requested amount to repay
     */
    function repayProtocolToken(uint256 amount) external;

    /**
     * @notice repay quote token from the recipient to the PRV
     * @param amount the requested amount to repay
     */
    function repayQuoteToken(uint256 amount) external;
}