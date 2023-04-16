pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/TreasuryReservesVault.sol)

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { Governable } from "contracts/common/access/Governable.sol";

contract TreasuryReservesVault is Governable {
    using SafeERC20 for IERC20;

    constructor(
        address _initialGov
    ) Governable(_initialGov)
    {}

// no funds are actually held in this contract. It just routes to the correct strategy.
    /**
     * @notice Recover any token from the debt token
     * @param token Token to recover
     * @param to Recipient address
     * @param amount Amount to recover
     */
    function recoverToken(address token, address to, uint256 amount) external onlyGov {
        emit CommonEventsAndErrors.TokenRecovered(to, token, amount);
        IERC20(token).safeTransfer(to, amount);
    }

}