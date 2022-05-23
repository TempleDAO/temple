// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.4;

import "./ICToken.sol";

/**
 * @title Compound's CErc20 Contract
 * @notice CTokens which wrap an EIP-20 underlying
 * @author Compound
 */
interface ICErc20 is ICToken {
    function underlying() external view returns (address);
    function liquidateBorrow(address borrower, uint repayAmount, ICToken cTokenCollateral) external returns (uint);
}