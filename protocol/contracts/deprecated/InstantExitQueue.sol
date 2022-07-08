pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IExitQueue} from "./IExitQueue.sol";
import "../deprecated/TempleStaking.sol";

/**
    @notice An exit queue implementation that instead of forcing user to withdraw, will instantly send funds straight back to the caller
 */
contract InstantExitQueue is IExitQueue {
    TempleStaking templeStaking;
    IERC20 templeToken;

    constructor(TempleStaking _templeStaking, TempleERC20Token _templeToken) {
        templeStaking = _templeStaking;
        templeToken = _templeToken;
    }

    /**
        @notice Immediately sends the funds to the _exiter
     */
    function join(address _exiter, uint256 _amount) override external {
        require(msg.sender == address(templeStaking), "only staking contract");
        {
            _exiter;
        }     
        SafeERC20.safeTransferFrom(templeToken, msg.sender, _exiter, _amount);
    }
}