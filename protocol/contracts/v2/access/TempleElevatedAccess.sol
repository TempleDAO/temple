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
     * @notice A set of addresses which are approved to execute emergency operations.
     */ 
    mapping(address => bool) public override rescuers;

    /**
     * @notice A set of addresses which are approved to execute normal operations on behalf of the DAO.
     */ 
    mapping(address => bool) public override executors;

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

    constructor(address initialRescuer, address initialExecutor) {
        rescuers[initialRescuer] = true;
        executors[initialExecutor] = true;
    }

    /**
     * @notice Set the contract into or out of rescue mode.
     * Only the rescuers or executors are allowed to set.
     */
    function setRescueMode(bool value) external override onlyExecutorsOrResucers {
        emit RescueModeSet(value);
        inRescueMode = value;
    }

    /**
     * @notice Grant `account` the emergency operations role
     */
    function setRescuer(address account, bool value) external override onlyElevatedAccess {
        if (account == address(0)) revert CommonEventsAndErrors.InvalidAddress(account);
        emit RescuerSet(account, value);
        rescuers[account] = value;
    }

    /**
     * @notice Grant `account` the executor role
     */
    function setExecutor(address account, bool value) external override onlyElevatedAccess {
        if (account == address(0)) revert CommonEventsAndErrors.InvalidAddress(account);
        emit ExecutorSet(account, value);
        executors[account] = value;
    }

    /**
     * @notice Grant `allowedCaller` the rights to call the function determined by the selector `fnSelector`
     * @dev fnSelector == bytes4(keccak256("fn(argType1,argType2,...)"))
     */
    function setExplicitAccess(address allowedCaller, bytes4 fnSelector, bool value) external override onlyElevatedAccess {
        if (allowedCaller == address(0)) revert CommonEventsAndErrors.InvalidAddress(allowedCaller);
        if (fnSelector == bytes4(0)) revert CommonEventsAndErrors.InvalidParam();
        emit ExplicitAccessSet(allowedCaller, fnSelector, value);
        explicitFunctionAccess[allowedCaller][fnSelector] = value;
    }

    function validateElevatedAccess(address caller, bytes4 fnSelector) internal view {
        if (inRescueMode) {
            if (!rescuers[caller]) {
                if (!explicitFunctionAccess[caller][fnSelector]) {
                    revert CommonEventsAndErrors.InvalidAccess();
                }
            }
        } else {
            if (!executors[caller]) {
                if (!explicitFunctionAccess[caller][fnSelector]) {
                    revert CommonEventsAndErrors.InvalidAccess();
                }
            }
        }
    }

    /**
     * @notice Under normal operations, only the executors are allowed to call.
     * If 'rescue mode' has been enabled, then only the rescuers are allowed to call.
     */
    modifier onlyElevatedAccess() {
        validateElevatedAccess(msg.sender, msg.sig);
        _;
    }

    /**
     * @notice Only the executors or rescuers can call.
     */
    modifier onlyExecutorsOrResucers() {
        if (!rescuers[msg.sender] && !executors[msg.sender]) revert CommonEventsAndErrors.InvalidAccess();
        _;
    }
}
