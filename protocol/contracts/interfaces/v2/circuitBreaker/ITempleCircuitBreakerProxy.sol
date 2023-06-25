pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/circuitBreaker/ITempleCircuitBreakerProxy.sol)

import { ITempleElevatedAccess } from "contracts/interfaces/v2/access/ITempleElevatedAccess.sol";
import { ITempleCircuitBreaker } from "contracts/interfaces/v2/circuitBreaker/ITempleCircuitBreaker.sol";

/**
 * @title Temple Circuit Breaker Proxy
 * 
 * @notice Direct circuit breaker requests to the correct underlying implementation,
 * based on a pre-defined bytes32 identifier, and a token.
 */
interface ITempleCircuitBreakerProxy is ITempleElevatedAccess {
    event CircuitBreakerSet(bytes32 indexed identifier, address indexed token, address circuitBreaker);

    /**
     * @notice The mapping of identifier (listed in TempleCircuitBreakerIdentifiers)
     * to the underlying circuit breaker contract
     */
    function circuitBreakers(
        bytes32 identifier, 
        address token
    ) external view returns (ITempleCircuitBreaker);

    /**
     * @notice Set the address of the circuit breaker for a particular identifier and token
     */
    function setCircuitBreaker(
        bytes32 identifier,
        address token,
        address circuitBreaker
    ) external;

    /**
     * @notice For a given identifier & token, verify the new amount requested for the sender does not breach the
     * cap in this rolling period.
     */
    function preCheck(
        bytes32 identifier,
        address token,
        address sender,
        uint256 amount
    ) external;

    /**
     * @notice The set of all identifiers registered
     */
    function identifiers() external view returns (bytes32[] memory);
}
