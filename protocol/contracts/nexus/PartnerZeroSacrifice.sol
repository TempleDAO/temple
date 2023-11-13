pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (nexus/PartnerZeroSacrifice.sol)

import { IRelic } from "../interfaces/nexus/IRelic.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ElevatedAccess } from "./access/ElevatedAccess.sol";
import { BaseSacrifice } from "./BaseSacrifice.sol";
import { CommonEventsAndErrors } from "../common/CommonEventsAndErrors.sol";

contract PartnerZeroSacrifice is BaseSacrifice {
    using SafeERC20 for IERC20;
    /// @notice the Relic ERC721A token
    IRelic public immutable relic;

    constructor(
        address _relic,
        address _executor
    ) ElevatedAccess(_executor) {
        relic = IRelic(_relic);
    }

    /*
     * @notice Get amount of TEMPLE tokens to mint a Relic
     * @return Relic price
     */
    function getPrice() external pure override returns (uint256) {
        return 0;
    }

    /*
     * @notice Partner's way to mint a Relic.
     * Partner's proxy contract is granted access to sacrifice. Partner proxy must validate minters before calling this function.
     * Also checking proxy is a contract
     * @param enclaveId Enclave ID
     */
    function sacrifice(uint256 enclaveId, address to) external override onlyElevatedAccess {
        if (block.timestamp < originTime) { revert FutureOriginTime(originTime); }
        if (msg.sender.code.length == 0) { revert CommonEventsAndErrors.InvalidAccess(); }
        relic.mintRelic(to, enclaveId);
        emit PartnerSacrifice(to);
    }
}