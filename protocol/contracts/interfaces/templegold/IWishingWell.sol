pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/templegold/IWishingWell.sol)

/// @title IWishingWell
/// @notice Record-only wishes: an account would give up to `fromAmount` of `fromToken` to get `toToken`, until
/// `expiresAt`.
/// Holds no money and checks nothing; the indexer applies balance, compliance and expiry rules off-chain.
interface IWishingWell {
    struct Wish {
        /// @notice Most of `fromToken` to give, in its base units. Zero means no wish.
        uint192 fromAmount;
        /// @notice Unix seconds; the wish counts zero from this time.
        uint64 expiresAt;
    }

    event WishSet(
        address indexed account,
        address indexed fromToken,
        address indexed toToken,
        uint256 fromAmount,
        uint64 expiresAt
    );

    /// @notice Set, replace or revoke (fromAmount 0) the caller's wish for the (fromToken, toToken) pair.
    function wish(address fromToken, address toToken, uint192 fromAmount, uint64 expiresAt) external;

    /// @notice The current wish of `account` for the (fromToken, toToken) pair.
    function wishOf(
        address account,
        address fromToken,
        address toToken
    ) external view returns (uint192 fromAmount, uint64 expiresAt);
}
