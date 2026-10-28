pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/WishingWell.sol)

import { IWishingWell } from "contracts/interfaces/templegold/IWishingWell.sol";

/// @title WishingWell
/// @notice See IWishingWell.
contract WishingWell is IWishingWell {
    /// @inheritdoc IWishingWell
    mapping(address account => mapping(address fromToken => mapping(address toToken => Wish wish))) public override
        wishOf;

    /// @inheritdoc IWishingWell
    function wish(address fromToken, address toToken, uint192 fromAmount, uint64 expiresAt) external override {
        emit WishSet(msg.sender, fromToken, toToken, fromAmount, expiresAt);
        wishOf[msg.sender][fromToken][toToken] = Wish(fromAmount, expiresAt);
    }
}
