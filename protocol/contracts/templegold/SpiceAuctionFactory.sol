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
    address public immutable override templeGold;

    /// @inheritdoc ISpiceAuctionFactory
    address public override implementation;

    /// @inheritdoc ISpiceAuctionFactory
    address public override daoExecutor;

    /// @inheritdoc ISpiceAuctionFactory
    address public override operator;

    /// @inheritdoc ISpiceAuctionFactory
    address public override strategyGnosis;

    /// @notice Mint chain layer zero EID
    uint32 private immutable _mintChainLzEid;

    /// @notice Arbitrum One chain ID
    uint32 private immutable _mintChainId;

    /// @inheritdoc ISpiceAuctionFactory
    mapping(address spiceToken => uint256 latestVersion) public override spiceTokenLatestVersion;

    /// @inheritdoc ISpiceAuctionFactory
    mapping(address spiceToken => mapping(uint256 version => address auction)) public override deployedAuctions;

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

    /// @inheritdoc ISpiceAuctionFactory
    function setStrategyGnosis(address _gnosis) external onlyElevatedAccess {
        if (_gnosis == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        strategyGnosis = _gnosis;
        emit StrategyGnosisSet(_gnosis);
    }

    /// @inheritdoc ISpiceAuctionFactory
    function setOperator(address _operator) external onlyElevatedAccess {
        if (_operator == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        operator = _operator;
        emit OperatorSet(_operator);
    }

    /// @inheritdoc ISpiceAuctionFactory
    function setDaoExecutor(address _executor) external onlyElevatedAccess {
        if (_executor == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        daoExecutor = _executor;
        emit DaoExecutorSet(_executor);
    }

    /// @inheritdoc ISpiceAuctionFactory
    function setImplementation(address _implementation) external onlyElevatedAccess {
        if (_implementation == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        implementation = _implementation;
        emit SpiceAuctionImplementationSet(_implementation);
    }

    /// @inheritdoc ISpiceAuctionFactory
    function createAuction(
        address spiceToken,
        string memory name
    ) external override onlyElevatedAccess returns (address spiceAuction) {
        if (spiceToken == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        if (spiceToken == templeGold) { revert CommonEventsAndErrors.InvalidParam(); }

        // deploy and initialize
        spiceAuction = Clones.clone(implementation);
        ISpiceAuction(spiceAuction).initialize(templeGold, spiceToken, daoExecutor, operator, strategyGnosis, _mintChainLzEid, _mintChainId, name);

        uint256 nextVersion = spiceTokenLatestVersion[spiceToken] + 1;
        spiceTokenLatestVersion[spiceToken] = nextVersion;
        deployedAuctions[spiceToken][nextVersion] = spiceAuction;

        emit AuctionCreated(spiceToken, nextVersion, spiceAuction);
    }

    /// @inheritdoc ISpiceAuctionFactory
    function findAuctionForSpiceToken(address spiceToken) external override view returns (address) {
        uint256 version = spiceTokenLatestVersion[spiceToken];
        return deployedAuctions[spiceToken][version];
    }

    /// @inheritdoc ISpiceAuctionFactory
    function getLastAuctionVersion(address spiceToken) external override view returns (uint256) {
        return spiceTokenLatestVersion[spiceToken];
    }
}