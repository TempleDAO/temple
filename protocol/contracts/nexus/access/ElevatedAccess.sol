pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (nexus/access/ElevatedAccess.sol)

import { IElevatedAccess } from "contracts/interfaces/nexus/access/IElevatedAccess.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

/**
 * @notice Inherit to add Executor role for DAO elevated access.
 */ 
abstract contract ElevatedAccess is IElevatedAccess {

    /**
     * @notice The address which is approved to execute normal operations on behalf of the DAO.
     */ 
    address public override executor;

    /**
     * @notice Explicit approval for an address to execute a function.
     * allowedCaller => function selector => true/false
     */
    mapping(address => mapping(bytes4 => bool)) public override explicitFunctionAccess;

    /// @dev Track proposed executor
    address private _proposedNewExecutor;

    constructor(address initialExecutor) {
        if (initialExecutor == address(0)) revert CommonEventsAndErrors.InvalidAddress();

        executor = initialExecutor;
    }

    /**
     * @notice Proposes a new Executor.
     * Can only be called by the current executor
     */
    function proposeNewExecutor(address account) external override onlyElevatedAccess {
        if (account == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        emit NewExecutorProposed(executor, _proposedNewExecutor, account);
        _proposedNewExecutor = account;
    }

    /**
     * @notice Caller accepts the role as new Executor.
     * Can only be called by the proposed executor
     */
    function acceptExecutor() external override {
        if (msg.sender != _proposedNewExecutor) revert CommonEventsAndErrors.InvalidAccess();

        emit NewExecutorAccepted(executor, msg.sender);
        executor = msg.sender;
        delete _proposedNewExecutor;
    }

    /**
     * @notice Grant `allowedCaller` the rights to call the function selectors in the access list.
     * @dev fnSelector == bytes4(keccak256("fn(argType1,argType2,...)"))
     */
    function setExplicitAccess(address allowedCaller, ExplicitAccess[] calldata access) external override onlyElevatedAccess {
        if (allowedCaller == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        uint256 _length = access.length;
        ExplicitAccess memory _access;
        for (uint256 i; i < _length; ++i) {
            _access = access[i];
            emit ExplicitAccessSet(allowedCaller, _access.fnSelector, _access.allowed);
            explicitFunctionAccess[allowedCaller][_access.fnSelector] = _access.allowed;
        }
    }

    function isElevatedAccess(address caller, bytes4 fnSelector) internal view returns (bool) {
        // true if the executor can call all functions
        // or the caller has been given explicit access on this function
        return (
            caller == executor || explicitFunctionAccess[caller][fnSelector]
        );
    }

    /**
     * @notice Under normal operations, only the executors are allowed to call..
     * @dev Important: Only for use when called from an *external* contract. 
     * If a function with this modifier is called internally then the `msg.sig` 
     * will still refer to the top level externally called function.
     */
    modifier onlyElevatedAccess() {
        if (!isElevatedAccess(msg.sender, msg.sig)) revert CommonEventsAndErrors.InvalidAccess();
        _;
    }
}
