pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/SpiceAuctionFactory.sol)


import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { SpiceAuction } from "contracts/templegold/SpiceAuction.sol";
import { ISpiceAuctionFactory } from "contracts/interfaces/templegold/ISpiceAuctionFactory.sol";


/** 
 * @title SpiceAuctionFactory
 * @notice Factory to create and keep track of spice auction contracts
 */
contract SpiceAuctionFactory is ISpiceAuctionFactory, TempleElevatedAccess {
    /// @notice Temple Gold
    address public immutable override templeGold;
    /// @notice Dao executing contract
    address public immutable override daoExecutor;
    /// @notice Operator
    address public immutable override operator;
    /// @notice Arbitrum One layer zero EID
    uint32 private immutable _arbitrumLzEid;
    /// @notice Arbitrum One chain ID
    uint32 private immutable _mintChainId;
    /// @notice Keep track of deployed spice auctions
    mapping(bytes32 id => address auction) public override deployedAuctions;

    constructor(
        address _rescuer,
        address _executor,
        address _daoExecutor,
        address _operator,
        address _templeGold,
        uint32 _arbLzEid,
        uint32 mintChainId_
    ) TempleElevatedAccess(_rescuer, _executor) {
        daoExecutor = _daoExecutor;
        operator = _operator;
        templeGold = _templeGold;
        _arbitrumLzEid = _arbLzEid;
        _mintChainId = mintChainId_;
    }

    /**
     * @notice Create Spice Auction contract
     * @param spiceToken Spice token
     * @param name Name of spice auction contract
     */
    function createAuction(
        address spiceToken,
        string memory name
    ) external override onlyElevatedAccess returns (address) {
        if (spiceToken == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        if (spiceToken == templeGold) { revert CommonEventsAndErrors.InvalidParam(); }
        SpiceAuction spiceAuction = new SpiceAuction(templeGold, spiceToken, daoExecutor, operator, _arbitrumLzEid, _mintChainId, name);
        bytes32 pairId = _getPairHash(spiceToken);
        /// @dev not checking pair address exists to allow overwrite in case of a migration
        deployedAuctions[pairId] = address(spiceAuction);
        emit AuctionCreated(pairId, address(spiceAuction));
        return address(spiceAuction);
    }

    /**
     * @notice Given a pair of tokens, retrieve spice auction contract
     * @param spiceToken Spice Token
     * @return Address of auction contract
     */
    function findAuctionForSpiceToken(address spiceToken) external override view returns (address) {
        bytes32 pairId = _getPairHash(spiceToken);
        return deployedAuctions[pairId];
    }

    /**
     * @notice Given a pair of tokens, retrieve pair hash Id
     * @param spiceToken Spice token
     * @return Id of token pair
     */
    function getPairId(address spiceToken) external override view returns (bytes32) {
        return _getPairHash(spiceToken);
    }

    function _getPairHash(address _spiceToken) private view returns (bytes32 pairId) {
        if (templeGold < _spiceToken) {
            pairId = keccak256(abi.encodePacked(templeGold, _spiceToken));
        } else {
            pairId = keccak256(abi.encodePacked(_spiceToken, templeGold));
        }
    }
}