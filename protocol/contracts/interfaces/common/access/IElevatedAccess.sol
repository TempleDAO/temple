pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interface/common/access/IElevatedAccess.sol)


interface IElevatedAccess {
    event ExplicitAccessSet(address indexed account, bytes4 indexed fnSelector, bool indexed value);

    event NewOwnerProposed(address indexed oldOwner, address indexed oldProposedOwner, address indexed newProposedOwner);
    event NewOwnerAccepted(address indexed oldOwner, address indexed newOwner);

    struct ExplicitAccess {
        bytes4 fnSelector;
        bool allowed;
    }

    /**
     * @notice The address of the current owner.
     */ 
    function owner() external returns (address);

    /**
     * @notice Explicit approval for an address to execute a function.
     * allowedCaller => function selector => true/false
     */
    function explicitFunctionAccess(address contractAddr, bytes4 functionSelector) external returns (bool);

    /**
     * @notice Proposes a new Owner.
     * Can only be called by the current owner
     */
    function proposeNewOwner(address account) external;

    /**
     * @notice Caller accepts the role as new Owner.
     * Can only be called by the proposed owner
     */
    function acceptOwner() external;

    /**
     * @notice Grant `allowedCaller` the rights to call the function selectors in the access list.
     * @dev fnSelector == bytes4(keccak256("fn(argType1,argType2,...)"))
     */
    function setExplicitAccess(address allowedCaller, ExplicitAccess[] calldata access) external;
}