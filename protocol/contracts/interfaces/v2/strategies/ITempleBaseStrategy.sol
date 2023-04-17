pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/strategies/ITempleBaseStrategy.sol)

import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";

/**
 * @title Temple Base Strategy
 * @notice A special Temple Strategy which is eligable to transiently apply capital
 * into a very safe yield bearing protocol (eg DAI Savings Rate).
 * 
 * The Treasury Reserves Vault will have permission to pull back funds from this strategy
 * at any time, for example when another strategy wants to borrow funds.
 */
interface ITempleBaseStrategy is ITempleStrategy {

    /**
     * @notice Periodically, the Base Strategy will pull as many idle reserves
     * from the TRV contract and apply in order to generate base yield 
     * (the basis of the dUSD base in interest rate.)
     *
     * These idle reserves will only be drawn from a balance of tokens in the TRV itself.
     */
    function borrowAndDepositMax() external returns (uint256);

    /**
     * @notice The same as `borrowMax()` but for a pre-determined amount to borrow,
     * such that something upstream/off-chain can determine the amount.
     */
    function borrowAndDeposit(uint256 amount) external returns (uint256);

    /**
     * @notice Withdraw funds from the Base Strategy and send to the TRV, 
     * in order to fund other strategy's borrow requests
     */
    function withdraw(uint256 amount) external returns (uint256);

}