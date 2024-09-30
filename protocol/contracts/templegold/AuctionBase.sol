pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/AuctionBase.sol)

import { IAuctionBase } from "contracts/interfaces/templegold/IAuctionBase.sol";

/**
 * @title AuctionBase 
 * @notice Base auction contract. Inherited by `DaiGoldAuction.sol` and `SpiceAuction.sol`
 */
abstract contract AuctionBase is IAuctionBase {
    /// @notice Current epoch id
    uint256 internal _currentEpochId;
    /// @notice Keep track of epochs details
    mapping(uint256 epochId => EpochInfo info) internal epochs;
    /// @notice Keep track of depositors for each epoch
    mapping(address depositor => mapping(uint256 epochId => uint256 amount)) public override depositors;
    /// @notice Keep track of claimed accounts per epoch
    mapping(address depositor => mapping(uint256 epochId => bool claimed)) public override claimed;
    /// @notice claimed amounts
    mapping(address depositor => mapping(uint256 epochId => uint256 claimedAmount)) public override claimedAmount;
    /// @notice For epochs without bids that are recovered
    mapping(uint256 epochId => bool recovered) public override epochsWithoutBidsRecovered;

    /**
     * @notice Get info on epoch
     * @param epochId Id of epoch
     */
    function getEpochInfo(uint256 epochId) external override view returns (EpochInfo memory) {
        return epochs[epochId];
    }
}