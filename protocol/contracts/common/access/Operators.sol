pragma solidity 0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Origami (common/access/Operators.sol)

/// @notice Inherit to add an Operator role which multiple addreses can be granted.
/// @dev Derived classes to implement addOperator() and removeOperator()
abstract contract Operators {
    /// @notice A set of addresses which are approved to run operations.
    mapping(address => bool) internal _operators;

    event AddedOperator(address indexed account);
    event RemovedOperator(address indexed account);

    error OnlyOperators(address caller);

    function operators(address _account) external view returns (bool) {
        return _operators[_account];
    }

    function _addOperator(address _account) internal {
        emit AddedOperator(_account);
        _operators[_account] = true;
    }

    /// @notice Grant `_account` the operator role
    /// @dev Derived classes to implement and add protection on who can call
    function addOperator(address _account) external virtual;

    function _removeOperator(address _account) internal {
        emit RemovedOperator(_account);
        delete _operators[_account];
    }

    /// @notice Revoke the operator role from `_account`
    /// @dev Derived classes to implement and add protection on who can call
    function removeOperator(address _account) external virtual;

    modifier onlyOperators() {
        if (!_operators[msg.sender]) revert OnlyOperators(msg.sender);
        _;
    }
}
