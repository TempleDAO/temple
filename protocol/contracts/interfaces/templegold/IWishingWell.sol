pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/templegold/IWishingWell.sol)

/// @title IWishingWell
/// @notice Record-only wishes: an account would give up to `amount` of `from` to get `to`, until `expiresAt`.
/// Holds no money and checks nothing; the indexer applies balance, compliance and expiry rules off-chain.
interface IWishingWell {
    struct Wish {
        /// @notice Most of `from` to give, in its base units. Zero means no wish.
        uint192 amount;
        /// @notice Unix seconds; the wish counts zero from this time.
        uint64 expiresAt;
    }

    event WishSet(address indexed account, address indexed from, address indexed to, uint256 amount, uint64 expiresAt);

    /// @notice Set, replace or revoke (amount 0) the caller's wish for the (from, to) pair.
    function wish(address from, address to, uint192 amount, uint64 expiresAt) external;

    /// @notice The current wish of `account` for the (from, to) pair.
    function wishOf(address account, address from, address to) external view returns (uint192 amount, uint64 expiresAt);
}
