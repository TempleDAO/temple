pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/access/ITempleCircuitBreakerProxy.sol)

import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { ITempleCircuitBreaker } from "contracts/interfaces/v2/access/ITempleCircuitBreaker.sol";
import { ITempleCircuitBreakerProxy } from "contracts/interfaces/v2/access/ITempleCircuitBreakerProxy.sol";

/**
 * @title Temple Circuit Breaker Proxy
 * 
 * @notice Direct circuit breaker requests to the correct underlying implementation,
 * based on a pre-defined bytes32 identifier, and a token.
 */
contract TempleCircuitBreakerProxy is ITempleCircuitBreakerProxy, TempleElevatedAccess {
    using EnumerableSet for EnumerableSet.Bytes32Set;

    /**
     * @notice The mapping of identifier (listed in TempleCircuitBreakerIdentifiers)
     * to the underlying circuit breaker contract
     */
    mapping(bytes32 => mapping(address => ITempleCircuitBreaker)) public override circuitBreakers;

    /**
     * @notice The list of all identifiers utilised
     */
    EnumerableSet.Bytes32Set internal _identifiers;

    constructor(
        address _initialRescuer,
        address _initialExecutor
    ) TempleElevatedAccess(_initialRescuer, _initialExecutor)
    // solhint-disable-next-line no-empty-blocks
    {}
    
    /**
     * @notice Set the address of the circuit breaker for a particular identifier and token
     */
    function setCircuitBreaker(
        bytes32 identifier,
        address token,
        address circuitBreaker
    ) external override onlyElevatedAccess {
        if (identifier == bytes32(0)) revert CommonEventsAndErrors.InvalidParam();
        if (circuitBreaker == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        circuitBreakers[identifier][token] = ITempleCircuitBreaker(circuitBreaker);
        _identifiers.add(identifier);
        emit CircuitBreakerSet(identifier, token, circuitBreaker);
    }

    /**
     * @notice For a given identifier & token, verify the new amount requested for the sender does not breach the
     * cap in this rolling period.
     */
    function preCheck(
        bytes32 identifier,
        address token,
        address sender,
        uint256 amount
    ) external override onlyElevatedAccess {
        // Don't bother checking the identifier exists to give a nicer error, as
        // it consumes extra gas when it will fail regardless
        circuitBreakers[identifier][token].preCheck(sender, amount);
    }

    /**
     * @notice The set of all identifiers registered
     */
    function identifiers() external override view returns (bytes32[] memory) {
        return _identifiers.values();
    }
}