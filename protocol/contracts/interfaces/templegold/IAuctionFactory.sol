pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/templegold/IAuctionFactory.sol)

import { IRescuableAccess } from "contracts/interfaces/templegold/IRescuableAccess.sol";

/// @title IAuctionFactory
/// @notice Clones the current auction implementation and records every clone, so indexers and front-ends can tell
/// genuine auctions from look-alikes. Every auction gets the calling msig as executor and this factory's current
/// rescuer. New auction code needs two keys: the msig proposes an implementation and the rescuer accepts it.
/// @dev An implementation must expose initialize(address executor, address rescuer), revert on any second call,
/// lock itself in its constructor, read its config from its clone args, and keep IFixedPriceAuction's events.
/// A TGLD auction must be authorized on TempleGold by its owner before any TGLD moves.
interface IAuctionFactory is IRescuableAccess {
    /// @notice `config` is the clone's immutable args; its layout is set by `implementation`.
    event AuctionCreated(address indexed auction, address indexed implementation, bytes config);
    /// @notice A zero implementation means the proposal was cancelled (rescue mode switched on).
    event ImplementationProposed(address indexed implementation);
    event ImplementationSet(address indexed implementation);

    /// @notice Clone the current implementation with `config` and initialize it, in one call. Msig only; locked
    /// in rescue mode.
    /// @param config The clone args, in the layout `implementation` expects; FixedPriceAuction takes
    /// abi.encode(IFixedPriceAuction.AuctionConfig) and validates it in initialize.
    function createAuction(bytes calldata config) external returns (address auction);

    /// @notice Propose `newImplementation` for future auctions, replacing any earlier proposal. Msig only; locked
    /// in rescue mode. Reverts if it has no code. Switching rescue mode on cancels a pending proposal.
    function proposeImplementation(address newImplementation) external;

    /// @notice Make newImplementation current. Rescuer only; reverts unless it is the current proposal. Existing
    /// auctions keep their code.
    function acceptImplementation(address newImplementation) external;

    /// @notice The code new auctions are cloned from.
    function implementation() external view returns (address);

    /// @notice The implementation awaiting the rescuer's acceptance. Zero means none.
    function proposedImplementation() external view returns (address);

    /// @notice True for every auction this factory created.
    function isAuction(address auction) external view returns (bool);
}
