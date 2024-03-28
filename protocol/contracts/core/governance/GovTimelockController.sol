pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (core/governance/GovTimelockController.sol)


import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";

/** 
 * @title TimelockController
 * @notice Timelock Controller
 */

contract GovTimelockController is TimelockController {

    constructor(
        uint256 _minDelay,
        address[] memory _proposers,
        address[] memory _executors,
        address _admin
    ) TimelockController(_minDelay, _proposers, _executors, _admin) {}
}