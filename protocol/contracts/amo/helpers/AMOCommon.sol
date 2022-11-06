pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later


library AMOCommon {
    error InvalidAddress();
    error NotOperator();
    error NotOperatorOrOwner();
    error ZeroSwapLimit();
    error AboveCappedAmount(uint256);
    error InsufficientBPTAmount(uint256);
    error InvalidBPSValue(uint256);
    error RebalanceAmountTolerance(uint256, uint256);
    error InsufficientAmountOutPostcall(uint256, uint256); //expected,actual
    error InvalidBalancerVaultRequest();
    error NotEnoughCooldown();
    error NoRebalanceUp();
    error NoRebalanceDown();
    error HighSlippage();
    error Paused();

    event RecoveredToken(address, address, uint256);
    event SetOperator(address);
    event SetPostRebalanceSlippage(uint64);
    event SetCooldown(uint64);
    event SetRebalanceRateChange(uint256);
    event SetPauseState(bool);
    event StableDeposited(uint256, uint256);
    event RebalanceUp(uint256, uint256);
    event RebalanceDown(uint256, uint256);
    event SetPoolHelper(address);
    event SetMaxRebalanceAmount(uint256);
}