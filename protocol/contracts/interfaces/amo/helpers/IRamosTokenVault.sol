pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/amo/helpers/ITokenVault.sol)

/**
 * @title Ramos vault token vault store
 *
 * @notice Ramos strategy uses this vault to borrow and repay protocol
 * and quote tokens from the TRV to the recipient
 * 
 * Both token types, protocol (e.g. Temple) & token (e.g. DAI) can:
 *  1/ Borrow specified tokens from the TVR to the ramos vault, and finally 
 *     from the vault to the recipient (TVR > Ramos strategy token vault > recipient)
 *  2/ Repay the specified tokens from the recipient to the 
 *     ramos vault, and from there to the TRV, effectivelly cancelling the initial
 *     debt adquired by the strategy (recipient > Ramos strategy token vault > TRV)
 *
 * TRV is in charge to mint/burn the mirror token debt equivalent
 */
interface IRamosTokenVault {
    /**
     * @notice borrow protocol token from the TRV to the recipient
     * @param amount the requested amount to borrow
     * @param address the recipient to send the amount requested to
     */
    function borrowProtocolToken(uint256 amount, address recipient) external;    

    /**
     * @notice borrow quote token from the TRV to the recipient
     * @param amount the requested amount to borrow
     * @param address the recipient to send the amount requested to
     */
    function borrowQuoteToken(uint256 amount, address recipient) external;

    /**
     * @notice repay protocol token from the recipient to the TRV
     * @param amount the requested amount to repay
     */
    function repayProtocolToken(uint256 amount) external;

    /**
     * @notice repay quote token from the recipient to the TRV
     * @param amount the requested amount to repay
     */
    function repayQuoteToken(uint256 amount) external;
}