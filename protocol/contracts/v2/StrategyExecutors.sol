pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Origami (common/access/StrategyExecutors.sol)

/// @notice Inherit to add an StrategyExecutors role which multiple addreses can be granted.
/// @dev Derived classes to implement addStrategyExecutor() and removeStrategyExecutor()
abstract contract StrategyExecutors {
    /// @notice A set of addresses which are approved to execute strategy operations.
    mapping(address => bool) internal _strategyExecutors;

    event AddedStrategyExecutor(address indexed account);
    event RemovedStrategyExecutor(address indexed account);

    error OnlyStrategyExecutors(address caller);

    function strategyExecutors(address _account) external view returns (bool) {
        return _strategyExecutors[_account];
    }

    function _addStrategyExecutor(address _account) internal {
        emit AddedStrategyExecutor(_account);
        _strategyExecutors[_account] = true;
    }

    /// @notice Grant `_account` the strategy executor role
    /// @dev Derived classes to implement and add protection on who can call
    function addStrategyExecutor(address _account) external virtual;

    function _removeStrategyExecutor(address _account) internal {
        emit RemovedStrategyExecutor(_account);
        delete _strategyExecutors[_account];
    }

    /// @notice Revoke the strategy executor role from `_account`
    /// @dev Derived classes to implement and add protection on who can call
    function removeStrategyExecutor(address _account) external virtual;

    modifier onlyStrategyExecutors() {
        if (!_strategyExecutors[msg.sender]) revert OnlyStrategyExecutors(msg.sender);
        _;
    }
}
