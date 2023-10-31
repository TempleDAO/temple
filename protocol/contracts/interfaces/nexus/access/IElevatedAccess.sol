pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/nexus/access/IElevatedAccess.sol)

/**
 * @notice Inherit to add Executor role for DAO elevated access.
 */ 
interface IElevatedAccess {
    event ExplicitAccessSet(address indexed account, bytes4 indexed fnSelector, bool indexed value);

    event NewExecutorProposed(address indexed oldExecutor, address indexed oldProposedExecutor, address indexed newProposedExecutor);
    event NewExecutorAccepted(address indexed oldExecutor, address indexed newExecutor);

    struct ExplicitAccess {
        bytes4 fnSelector;
        bool allowed;
    }

    /**
     * @notice A set of addresses which are approved to execute normal operations on behalf of the DAO.
     */ 
    function executor() external returns (address);

    /**
     * @notice Explicit approval for an address to execute a function.
     * allowedCaller => function selector => true/false
     */
    function explicitFunctionAccess(address contractAddr, bytes4 functionSelector) external returns (bool);

    /**
     * @notice Proposes a new Executor.
     * Can only be called by the current executor or resucer (if in resuce mode)
     */
    function proposeNewExecutor(address account) external;

    /**
     * @notice Caller accepts the role as new Executor.
     * Can only be called by the proposed executor
     */
    function acceptExecutor() external;

    /**
     * @notice Grant `allowedCaller` the rights to call the function selectors in the access list.
     * @dev fnSelector == bytes4(keccak256("fn(argType1,argType2,...)"))
     */
    function setExplicitAccess(address allowedCaller, ExplicitAccess[] calldata access) external;
}
