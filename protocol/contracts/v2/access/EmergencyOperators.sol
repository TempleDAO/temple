pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/access/EmergencyOperators.sol)

/**
 * @notice Inherit to add an EmergencyOperators role which multiple addreses can be granted.
 * @dev Derived classes to implement addEmergencyOperator() and removeEmergencyOperator()
 */ 
abstract contract EmergencyOperators {
    /**
     * @notice A set of addresses which are approved to execute emergency operations.
     */ 
    mapping(address => bool) public emergencyOperators;

    event AddedEmergencyOperator(address indexed account);
    event RemovedEmergencyOperator(address indexed account);

    error OnlyEmergencyOperators(address caller);

    function _addEmergencyOperator(address _account) internal {
        emit AddedEmergencyOperator(_account);
        emergencyOperators[_account] = true;
    }

    /**
     * @notice Grant `_account` the emergency operations role
     * @dev Derived classes to implement and add protection on who can call
     */
    function addEmergencyOperator(address _account) external virtual;

    function _removeEmergencyOperator(address _account) internal {
        emit RemovedEmergencyOperator(_account);
        delete emergencyOperators[_account];
    }

    /**
     * @notice Revoke the emergency operations role from `_account`
     * @dev Derived classes to implement and add protection on who can call
     */
    function removeEmergencyOperator(address _account) external virtual;

    modifier onlyEmergencyOperators() {
        if (!emergencyOperators[msg.sender]) revert OnlyEmergencyOperators(msg.sender);
        _;
    }
}
