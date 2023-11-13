pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (tests/forge/nexus/MockSacrifice.t.sol)


import { BaseSacrifice } from "../../../contracts/nexus/BaseSacrifice.sol";
import { ElevatedAccess } from "../../../contracts/nexus/access/ElevatedAccess.sol";

contract MockSacrifice is BaseSacrifice {
    constructor(
        address _executor
    ) ElevatedAccess(_executor) {
        /// @dev caution so that origin time is never 0 and lesser than or equal to current block timestamp
        originTime = uint64(block.timestamp);
    }
}