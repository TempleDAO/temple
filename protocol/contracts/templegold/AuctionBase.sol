pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/AuctionBase.sol)

import { IAuctionBase } from "contracts/interfaces/templegold/IAuctionBase.sol";

abstract contract AuctionBase is IAuctionBase {
    /// @notice Current epoch id
    uint256 internal _currentEpochId;
    /// @notice Keep track of epochs details
    mapping(uint256 epochId => EpochInfo info) internal epochs;
    /// @notice Keep track of depositors for each epoch
    mapping(address depositor => mapping(uint256 epochId => uint256 amount)) public override depositors;

    function _canDeposit() internal view returns (bool) {
        EpochInfo storage info = epochs[_currentEpochId];
        return info.startTime <= block.timestamp && block.timestamp < info.endTime;
    }

    function _isCurrentEpochEnded() internal view returns (bool){
        EpochInfo storage info = epochs[_currentEpochId];
        return info.endTime <= block.timestamp;
    }

    /**
     * @notice Get info on epoch
     * @param epochId Id of epoch
     */
    function getEpochInfo(uint256 epochId) external override view returns (EpochInfo memory) {
        return epochs[epochId];
    }
}