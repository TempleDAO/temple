pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/FixedPriceAuctionFactory.sol)

import { LibClone } from "solady/src/utils/LibClone.sol";

import { IFixedPriceAuction } from "contracts/interfaces/templegold/IFixedPriceAuction.sol";
import { IFixedPriceAuctionFactory } from "contracts/interfaces/templegold/IFixedPriceAuctionFactory.sol";
import { RescuableAccess } from "contracts/templegold/access/RescuableAccess.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

/// @title FixedPriceAuctionFactory
/// @notice See IFixedPriceAuctionFactory.
contract FixedPriceAuctionFactory is IFixedPriceAuctionFactory, RescuableAccess {
    /// @inheritdoc IFixedPriceAuctionFactory
    address public override implementation;

    /// @inheritdoc IFixedPriceAuctionFactory
    address public override proposedImplementation;

    /// @inheritdoc IFixedPriceAuctionFactory
    mapping(address auction => bool genuine) public override isAuction;

    constructor(address initialExecutor, address initialRescuer, address initialImplementation) {
        _initRescuableAccess(initialExecutor, initialRescuer);
        if (initialImplementation.code.length == 0) revert CommonEventsAndErrors.InvalidAddress();
        emit ImplementationSet(initialImplementation);
        implementation = initialImplementation;
    }

    /// @inheritdoc IFixedPriceAuctionFactory
    function createAuction(bytes calldata config) external override onlyElevatedAccess returns (address auction) {
        address impl = implementation;
        auction = LibClone.clone(impl, config);
        isAuction[auction] = true;
        emit AuctionCreated(auction, impl, config);
        IFixedPriceAuction(auction).initialize(executor, rescuer);
    }

    /// @inheritdoc IFixedPriceAuctionFactory
    function proposeImplementation(address newImplementation) external override onlyElevatedAccess {
        if (newImplementation.code.length == 0) revert CommonEventsAndErrors.InvalidAddress();
        emit ImplementationProposed(newImplementation);
        proposedImplementation = newImplementation;
    }

    /// @inheritdoc IFixedPriceAuctionFactory
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
