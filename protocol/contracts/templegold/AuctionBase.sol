pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/AuctionBase.sol)


import { mulDiv } from "@prb/math/src/Common.sol";
import { IAuctionBase } from "contracts/interfaces/templegold/IAuctionBase.sol";

abstract contract AuctionBase is IAuctionBase {

    /// @notice Current epoch id
    uint256 internal _currentEpochId;
    /// @notice Keep track of epochs details
    mapping(uint256 epochId => EpochInfo info) public epochs;
    /// @notice Keep track of depositors for each epoch
    mapping(address depositor => mapping(uint256 epochId => uint256 amount)) public depositors;
    /**
     * @notice Deposit token to pledge for auction token in return
     * @param amount Amount of sell token to pledge
     */
    function deposit(uint256 amount) external virtual {}
    /**
     * @notice Claim auction tokens for an epoch
     * @param epochId Epoch ID
     */
    function claim(uint256 epochId) external virtual {}

    function _canDeposit() internal view returns (bool) {
        EpochInfo memory info = epochs[_currentEpochId];
        return info.startTime <= block.timestamp && block.timestamp < info.endTime;
    }

    function _isCurrentEpochEnded() internal view returns (bool){
        EpochInfo memory info = epochs[_currentEpochId];
        return info.endTime < block.timestamp;
    }

    /// @notice mulDiv with an option to round the result up or down to the nearest wei
    function _mulDivRound(uint256 x, uint256 y, uint256 denominator, bool roundUp) internal pure returns (uint256 result) {
        result = mulDiv(x, y, denominator);
        // See OZ Math.sol for the equivalent mulDiv() with rounding.
        if (roundUp && mulmod(x, y, denominator) > 0) {
            result += 1;
        }
    }
}