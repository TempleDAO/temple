pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/access/TempleCircuitBreakerIdentifiers.sol)

library TempleCircuitBreakerIdentifiers {
    /// @notice The circuit breaker ID to group all external users - for TLC, Spice Bazaar, etc.
    bytes32 public constant EXTERNAL_ALL_USERS = keccak256("EXTERNAL_USER");

    /// @notice The circuit breaker ID to group all internal Temple strategies - 
    /// eg Gnosis strategies from the Treasury Reserve Vault.
    bytes32 public constant INTERNAL_ALL_STRATEGIES = keccak256("INTERNAL_STRATEGY");
}