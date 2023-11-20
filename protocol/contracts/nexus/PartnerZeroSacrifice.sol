pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (nexus/PartnerZeroSacrifice.sol)

import { IRelic } from "../interfaces/nexus/IRelic.sol";
import { IPartnerSacrifice } from "../interfaces/nexus/IBaseSacrifice.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ElevatedAccess } from "./access/ElevatedAccess.sol";
import { CommonEventsAndErrors } from "../common/CommonEventsAndErrors.sol";

contract PartnerZeroSacrifice is IPartnerSacrifice, ElevatedAccess {
    using SafeERC20 for IERC20;
    /// @notice the Relic ERC721A token
    IRelic public immutable relic;
    /// @notice start time from which price increases
    uint64 public originTime;

    uint256 public override mintCap;
    uint256 public override totalMinted;

    constructor(
        address _relic,
        address _executor
    ) ElevatedAccess(_executor) {
        relic = IRelic(_relic);
    }

    function setMintCap(uint256 cap) external override onlyElevatedAccess {
        /// @dev cap can be 0. For unlimited mints
        mintCap = cap;
        emit RelicMintCapSet(cap);
    }

    /*
     * @notice Set origin time.
     * Origin time is the start of the linear ascending price to params.priceMaxPeriod
     * @param _originTime Origin time
     */
    function setOriginTime(uint64 _originTime) external override onlyElevatedAccess {
        if (_originTime < block.timestamp) { revert CommonEventsAndErrors.InvalidParam(); }
        originTime = _originTime;
        emit OriginTimeSet(originTime);
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
     * Partner's proxy contract is granted access to sacrifice. 
     * Partner proxy must validate minters before calling this function.
     * @param enclaveId Enclave ID
     * @param to Address of recipient
     */
    function sacrifice(uint256 enclaveId, address to) external override onlyElevatedAccess {
        // todo Put cap on amount of Relics to mint
        if (block.timestamp < originTime) { revert FutureOriginTime(originTime); }
        if (to == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        uint256 relicId = relic.nextTokenId();
        uint256 _newTotalMinted = totalMinted + 1;
        if (mintCap > 0  && _newTotalMinted > mintCap) {
            revert MintCapExceeded(_newTotalMinted);
        }
        totalMinted = _newTotalMinted;

        relic.mintRelic(to, enclaveId);
        emit PartnerSacrifice(to, relicId, enclaveId);
    }
}