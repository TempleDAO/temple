pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (tests/forge/nexus/MockSacrifice.t.sol)


import { BaseSacrifice } from "../../../contracts/nexus/BaseSacrifice.sol";
import { ElevatedAccess } from "../../../contracts/nexus/access/ElevatedAccess.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockSacrifice is BaseSacrifice {

    IERC20 public sacrificeToken;
    constructor(
        address _executor
    ) ElevatedAccess(_executor) {
        /// @dev caution so that origin time is never 0 and lesser than or equal to current block timestamp
        originTime = uint64(block.timestamp);
    }

    function sacrifice(uint256 enclaveId, address to) external virtual returns (uint256 relicId) {}
}