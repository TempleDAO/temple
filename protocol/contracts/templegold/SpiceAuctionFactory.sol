pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/SpiceAuctionFactory.sol)


import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { SpiceAuction } from "contracts/templegold/SpiceAuction.sol";
import { ISpiceAuctionFactory } from "contracts/interfaces/templegold/ISpiceAuctionFactory.sol";

contract SpiceAuctionFactory is ISpiceAuctionFactory, TempleElevatedAccess {
    /// @notice Temple Gold
    address public immutable override templeGold;
    /// @notice Dao executing contract
    address public immutable override daoExecutor;
    address public immutable override treasury;
    /// @notice Keep track of deployed spice auctions
    mapping(bytes32 id => address auction) public override deployedAuctions;

    constructor(
        address _rescuer,
        address _executor,
        address _daoExecutor,
        address _treasury,
        address _templeGold
    ) TempleElevatedAccess(_rescuer, _executor) {
        daoExecutor = _daoExecutor;
        templeGold = _templeGold;
        treasury = _treasury;
    }

    /**
     * @notice Create Spice Auction contract
     * @param spiceToken Spice token
     * @param name Name of spice auction contract
     */
    function createAuction(address spiceToken, string memory name) external override onlyElevatedAccess returns (address) {
        if (spiceToken == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        SpiceAuction spiceAuction = new SpiceAuction(templeGold, spiceToken, daoExecutor, treasury, name);
        bytes32 pairId = _getPairHash(spiceToken);
        if (deployedAuctions[pairId] != address(0)) { revert PairExists(templeGold, spiceToken); }
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
        // cache
        address _templeGold = templeGold;
        if (_templeGold < _spiceToken) {
            pairId = keccak256(abi.encodePacked(_templeGold, _spiceToken));
        } else {
            pairId = keccak256(abi.encodePacked(_spiceToken, _templeGold));
        }
    }
}