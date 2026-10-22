pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/access/ExecutorAccess.sol)

import { IExecutorAccess } from "contracts/interfaces/templegold/IExecutorAccess.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

/// @title ExecutorAccess
/// @notice See IExecutorAccess.
abstract contract ExecutorAccess is IExecutorAccess {
    /// @inheritdoc IExecutorAccess
    address public override executor;

    /// @inheritdoc IExecutorAccess
    address public override proposedExecutor;

    /// @dev Call once, from the inheriting contract's constructor or initializer.
    function _initExecutorAccess(address initialExecutor) internal {
        if (initialExecutor == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        executor = initialExecutor;
    }

    /// @inheritdoc IExecutorAccess
    function proposeNewExecutor(address account) external override onlyElevatedAccess {
        if (account == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        emit NewExecutorProposed(executor, proposedExecutor, account);
        proposedExecutor = account;
    }

    /// @inheritdoc IExecutorAccess
    function acceptExecutor() external virtual override {
        _acceptExecutor();
    }

    function _acceptExecutor() internal {
        if (msg.sender != proposedExecutor) revert CommonEventsAndErrors.InvalidAccess();
        emit NewExecutorAccepted(executor, msg.sender);
        executor = msg.sender;
        delete proposedExecutor;
    }

    /// @dev Whether caller may call fnSelector: the executor, unless an inheriting contract narrows or widens it.
    function _isElevatedAccess(address caller, bytes4 /* fnSelector */) internal view virtual returns (bool) {
        return caller == executor;
    }

    /// @dev `msg.sig` is the top-level externally called function, even if this is reached internally.
    modifier onlyElevatedAccess() {
        _requireElevatedAccess();
        _;
    }

    function _requireElevatedAccess() internal view {
        if (!_isElevatedAccess(msg.sender, msg.sig)) revert CommonEventsAndErrors.InvalidAccess();
    }
}
