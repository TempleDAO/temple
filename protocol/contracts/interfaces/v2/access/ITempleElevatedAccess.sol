pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/access/ITempleElevatedAccess.sol)

/**
 * @notice Inherit to add Executor and Rescuer roles for DAO elevated access.
 */ 
interface ITempleElevatedAccess {
    event ExecutorSet(address indexed account, bool indexed value);
    event RescuerSet(address indexed account, bool indexed value);
    event ExplicitAccessSet(address indexed account, bytes4 indexed fnSelector, bool indexed value);
    event RescueModeSet(bool indexed value);

    /**
     * @notice A set of addresses which are approved to execute emergency operations.
     */ 
    function rescuers(address account) external returns (bool);

    /**
     * @notice A set of addresses which are approved to execute normal operations on behalf of the DAO.
     */ 
    function executors(address account) external returns (bool);

    /**
     * @notice Explicit approval for an address to execute a function.
     * allowedCaller => function selector => true/false
     */
    function explicitFunctionAccess(address contractAddr, bytes4 functionSelector) external returns (bool);

    /**
     * @notice Under normal circumstances, rescuers don't have access to admin/operational functions.
     * However when rescue mode is enabled (by rescuers or executors), they claim the access rights.
     */
    function inRescueMode() external returns (bool);
    
    /**
     * @notice Set the contract into or out of rescue mode.
     * Only the rescuers or executors are allowed to set.
     */
    function setRescueMode(bool value) external;

    /**
     * @notice Grant `account` the emergency operations role
     */
    function setRescuer(address account, bool value) external;

    /**
     * @notice Grant `account` the executor role
     */
    function setExecutor(address account, bool value) external;

    /**
     * @notice Grant `allowedCaller` the rights to call the function determined by the selector `fnSelector`
     * @dev fnSelector == bytes4(keccak256("fn(argType1,argType2,...)"))
     */
    function setExplicitAccess(address allowedCaller, bytes4 fnSelector, bool value) external;
}
