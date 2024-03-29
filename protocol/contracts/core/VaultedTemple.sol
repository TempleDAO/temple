pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./Exposure.sol";

/**
 * @title All temple in all vaults
 *
 * @dev A vault doesn't hold any temple, it holds a synthetic exposure
 * (Temple Exposure). The same as all other exposures.
 *
 * One key difference is this temple is accessible by the protocol
 * to use as collateral on lending platforms to give leverage to
 * our farming strategies.
 *
 * This is also an Exposure's liquidator, as a vault, when a user
 * is withdrawing will liquidate it's temple exposure and return
 * it the user.
 *
 * This implies a simple precondition. There is always sufficient
 * free temple in this contract to allow all vaults in their
 * exit/entry window to withdraw all deposited temple.
 *
 * All other temple is now available as collateral for the protocol
 * to use in lending platforms.
 *
 * This version has a manual method in which to withdraw temple,
 * eventually, we expect to automate this as we bake in the temple
 * dao leverage strategy.
 */
contract VaultedTemple is ILiquidator, Ownable {
    IERC20 public immutable templeToken;
    address public immutable templeExposure;

    constructor(IERC20 _templeToken, address _templeExposure) Ownable(msg.sender) {
        templeToken = _templeToken;
        templeExposure = _templeExposure;
    }

    function toTemple(uint256 amount, address toAccount) external override {
        require(msg.sender == templeExposure, "VaultedTemple: Only TempeExposure can redeem temple on behalf of a vault");
        SafeERC20.safeTransfer(templeToken, toAccount, amount);
    }

    /**
    * transfer out amount of token to provided address
    */
    function withdraw(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "to address zero");

        if (token == address(0)) {
            (bool sent,) = payable(to).call{value: amount}("");
            require(sent, "send failed");
        } else {
            SafeERC20.safeTransfer(IERC20(token), to, amount);
        }
    }
}