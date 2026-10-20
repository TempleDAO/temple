pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/WishingWell.sol)

import { IWishingWell } from "contracts/interfaces/templegold/IWishingWell.sol";

/// @title WishingWell
/// @notice See IWishingWell.
contract WishingWell is IWishingWell {
    /// @inheritdoc IWishingWell
    mapping(address account => mapping(address from => mapping(address to => Wish wish))) public override wishOf;

    /// @inheritdoc IWishingWell
    function wish(address from, address to, uint192 amount, uint64 expiresAt) external override {
        emit WishSet(msg.sender, from, to, amount, expiresAt);
        wishOf[msg.sender][from][to] = Wish(amount, expiresAt);
    }
}
