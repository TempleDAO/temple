pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/access/TempleElevatedAccess.sol)

import { ITempleElevatedAccess } from "contracts/interfaces/v2/access/ITempleElevatedAccess.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

/**
 * @notice Inherit to add Executor and Rescuer roles for DAO elevated access.
 */ 
abstract contract TempleElevatedAccess is ITempleElevatedAccess {
    /**
     * @notice The address which is approved to execute emergency operations.
     */ 
    address public override rescuer;

    /**
     * @notice The address which is approved to execute normal operations on behalf of the DAO.
     */ 
    address public override executor;

    /**
     * @notice Explicit approval for an address to execute a function.
     * allowedCaller => function selector => true/false
     */
    mapping(address => mapping(bytes4 => bool)) public override explicitFunctionAccess;

    /**
     * @notice Under normal circumstances, rescuers don't have access to admin/operational functions.
     * However when rescue mode is enabled (by rescuers or executors), they claim the access rights.
     */
    bool public override inRescueMode;

    /// @dev Track proposed rescuer/executor
    address private _proposedNewRescuer;
    address private _proposedNewExecutor;

    constructor(address initialRescuer, address initialExecutor) {
        rescuer = initialRescuer;
        executor = initialExecutor;
    }

    /**
     * @notice Set the contract into or out of rescue mode.
     * Only the rescuers are allowed to set.
     */
    function setRescueMode(bool value) external override {
        if (msg.sender != rescuer) revert CommonEventsAndErrors.InvalidAccess();
        emit RescueModeSet(value);
        inRescueMode = value;
    }

    /**
     * @notice Proposes a new Rescuer.
     * Can only be called by the current rescuer.
     */
    function proposeNewRescuer(address account) external override {
        if (msg.sender != rescuer) revert CommonEventsAndErrors.InvalidAccess();
        if (account == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        emit NewRescuerProposed(rescuer, _proposedNewRescuer, account);
        _proposedNewRescuer = account;
    }

    /**
     * @notice Caller accepts the role as new Rescuer.
     * Can only be called by the proposed rescuer
     */
    function acceptRescuer() external override {
        if (msg.sender != _proposedNewRescuer) revert CommonEventsAndErrors.InvalidAccess();
        emit NewRescuerAccepted(rescuer, msg.sender);
        rescuer = msg.sender;
        delete _proposedNewRescuer;
    }

    /**
     * @notice Proposes a new Executor.
     * Can only be called by the current executor or rescuer (if in resuce mode)
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
            if (_access.fnSelector == bytes4(0)) revert CommonEventsAndErrors.InvalidParam();
            emit ExplicitAccessSet(allowedCaller, _access.fnSelector, _access.allowed);
            explicitFunctionAccess[allowedCaller][_access.fnSelector] = _access.allowed;
        }
    }

    function isElevatedAccess(address caller, bytes4 fnSelector) internal view returns (bool) {
        if (inRescueMode) {
            // If we're in rescue mode, then only the rescuers can call
            return caller == rescuer;
        } else if (caller == executor || explicitFunctionAccess[caller][fnSelector]) {
            // If we're not in rescue mode, the executors can call all functions
            // or the caller has been given explicit access on this function
            return true;
        }
        return false;
    }

    /**
     * @notice Under normal operations, only the executors are allowed to call.
     * If 'rescue mode' has been enabled, then only the rescuers are allowed to call.
     */
    modifier onlyElevatedAccess() {
        // @todo AUDITORS -- are there any security concerns with using `msg.sig` in this way?
        if (!isElevatedAccess(msg.sender, msg.sig)) revert CommonEventsAndErrors.InvalidAccess();
        _;
    }

    /**
     * @notice Only the executors or rescuers can call.
     */
    modifier onlyInRescueMode() {
        if (!(inRescueMode && msg.sender == rescuer)) revert CommonEventsAndErrors.InvalidAccess();
        _;
    }
}
