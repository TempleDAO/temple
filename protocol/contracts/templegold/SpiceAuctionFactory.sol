pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/SpiceAuctionFactory.sol)

import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";

import { ISpiceAuctionFactory } from "contracts/interfaces/templegold/ISpiceAuctionFactory.sol";
import { ISpiceAuction } from "contracts/interfaces/templegold/ISpiceAuction.sol";

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";


/** 
 * @title SpiceAuctionFactory
 * @notice Factory to create and keep track of spice auction contracts
 */
contract SpiceAuctionFactory is ISpiceAuctionFactory, TempleElevatedAccess {

    /// @inheritdoc ISpiceAuctionFactory
    address public immutable override implementation;

     /// @inheritdoc ISpiceAuctionFactory
    address public immutable override templeGold;

    /// @inheritdoc ISpiceAuctionFactory
    address public immutable override daoExecutor;

    /// @inheritdoc ISpiceAuctionFactory
    address public immutable override operator;

    /// @inheritdoc ISpiceAuctionFactory
    address public immutable override strategyGnosis;

    /// @notice Mint chain layer zero EID
    uint32 private immutable _mintChainLzEid;

    /// @notice Arbitrum One chain ID
    uint32 private immutable _mintChainId;

    /// @notice Keep track of deployed spice auctions
    mapping(bytes32 id => address auction) public override deployedAuctions;

    constructor(
        address implementation_,
        address rescuer_,
        address executor_,
        address daoExecutor_,
        address operator_,
        address strategyGnosis_,
        address templeGold_,
        uint32 mintChainLzEid_,
        uint32 mintChainId_
    ) TempleElevatedAccess(rescuer_, executor_) {
        implementation = implementation_;
        daoExecutor = daoExecutor_;
        operator = operator_;
        strategyGnosis = strategyGnosis_;
        templeGold = templeGold_;
        _mintChainLzEid = mintChainLzEid_;
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
    ) external override onlyElevatedAccess returns (address spiceAuction) {
        if (spiceToken == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        if (spiceToken == templeGold) { revert CommonEventsAndErrors.InvalidParam(); }

        // deploy and initialize
        spiceAuction = Clones.clone(implementation);
        ISpiceAuction(spiceAuction).initialize(templeGold, spiceToken, daoExecutor, operator, strategyGnosis, _mintChainLzEid, _mintChainId, name);

        bytes32 pairId = _getPairHash(spiceToken);
        // not checking pair address exists to allow overwrite in case of a migration
        deployedAuctions[pairId] = spiceAuction;
        emit AuctionCreated(pairId, spiceAuction);
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