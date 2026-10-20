pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/AuctionFactory.sol)

import { LibClone } from "solady/src/utils/LibClone.sol";

import { IFixedPriceAuction } from "contracts/interfaces/templegold/IFixedPriceAuction.sol";
import { IAuctionFactory } from "contracts/interfaces/templegold/IAuctionFactory.sol";
import { RescuableAccess } from "contracts/templegold/access/RescuableAccess.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

/// @title AuctionFactory
/// @notice See IAuctionFactory.
contract AuctionFactory is IAuctionFactory, RescuableAccess {
    /// @inheritdoc IAuctionFactory
    address public override implementation;

    /// @inheritdoc IAuctionFactory
    address public override proposedImplementation;

    /// @inheritdoc IAuctionFactory
    mapping(address auction => bool genuine) public override isAuction;

    constructor(address initialExecutor, address initialRescuer, address initialImplementation) {
        _initRescuableAccess(initialExecutor, initialRescuer);
        if (initialImplementation.code.length == 0) revert CommonEventsAndErrors.InvalidAddress();
        emit ImplementationSet(initialImplementation);
        implementation = initialImplementation;
    }

    /// @inheritdoc IAuctionFactory
    function createAuction(bytes calldata config) external override onlyElevatedAccess returns (address auction) {
        address impl = implementation;
        auction = LibClone.clone(impl, config);
        isAuction[auction] = true;
        emit AuctionCreated(auction, impl, config);
        IFixedPriceAuction(auction).initialize(executor, rescuer);
    }

    /// @inheritdoc IAuctionFactory
    function proposeImplementation(address newImplementation) external override onlyElevatedAccess {
        if (newImplementation.code.length == 0) revert CommonEventsAndErrors.InvalidAddress();
        emit ImplementationProposed(newImplementation);
        proposedImplementation = newImplementation;
    }

    /// @inheritdoc IAuctionFactory
    function acceptImplementation(address newImplementation) external override onlyRescuer {
        if (newImplementation == address(0) || newImplementation != proposedImplementation) {
            revert CommonEventsAndErrors.InvalidAddress();
        }
        emit ImplementationSet(newImplementation);
        implementation = newImplementation;
        delete proposedImplementation;
    }

    function _cancelPendingOnRescue() internal override {
        if (proposedImplementation != address(0)) {
            emit ImplementationProposed(address(0));
            delete proposedImplementation;
        }
    }
}
