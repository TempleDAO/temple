pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (common/access/ElevatedAccess.sol)

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { IElevatedAccess } from "contracts/interfaces/common/access/IElevatedAccess.sol";

/**
 * @notice Inherit to add Owner roles for DAO elevated access.
 */ 
abstract contract ElevatedAccess is IElevatedAccess {
    /**
     * @notice The address of the current owner.
     */ 
    address public override owner;

    /**
     * @notice Explicit approval for an address to execute a function.
     * allowedCaller => function selector => true/false
     */
    mapping(address => mapping(bytes4 => bool)) public override explicitFunctionAccess;

    /// @dev Track proposed owner
    address private _proposedNewOwner;

    function _init(address initialOwner) internal {
        if (owner != address(0)) revert CommonEventsAndErrors.InvalidAccess();
        if (initialOwner == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        owner = initialOwner;
    }

    /**
     * @notice Proposes a new Owner.
     * Can only be called by the current owner
     */
    function proposeNewOwner(address account) external override onlyElevatedAccess {
        if (account == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        emit NewOwnerProposed(owner, _proposedNewOwner, account);
        _proposedNewOwner = account;
    }

    /**
     * @notice Caller accepts the role as new Owner.
     * Can only be called by the proposed owner
     */
    function acceptOwner() external override {
        if (msg.sender != _proposedNewOwner) revert CommonEventsAndErrors.InvalidAccess();

        emit NewOwnerAccepted(owner, msg.sender);
        owner = msg.sender;
        delete _proposedNewOwner;
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
        return (
            caller == owner || 
            explicitFunctionAccess[caller][fnSelector]
        );
    }

    /**
     * @notice The owner is allowed to call, or if explicit access has been given to the caller.
     * @dev Important: Only for use when called from an *external* contract. 
     * If a function with this modifier is called internally then the `msg.sig` 
     * will still refer to the top level externally called function.
     */
    modifier onlyElevatedAccess() {
        if (!isElevatedAccess(msg.sender, msg.sig)) revert CommonEventsAndErrors.InvalidAccess();
        _;
    }
}