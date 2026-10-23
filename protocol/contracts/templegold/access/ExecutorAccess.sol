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

    /// @inheritdoc IExecutorAccess
    uint40 public override proposedExecutorAt;

    /// @inheritdoc IExecutorAccess
    uint256 public constant override EXECUTOR_HANDOVER_DELAY = 1 days;

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
        // Safe: unix seconds fit in uint40 until the year 36812.
        // forge-lint: disable-next-line(unsafe-typecast)
        proposedExecutorAt = uint40(block.timestamp);
    }

    /// @inheritdoc IExecutorAccess
    function acceptExecutor() external virtual override {
        _acceptExecutor();
    }

    function _acceptExecutor() internal {
        if (msg.sender != proposedExecutor) revert CommonEventsAndErrors.InvalidAccess();
        uint256 readyAt = proposedExecutorAt + EXECUTOR_HANDOVER_DELAY;
        if (block.timestamp < readyAt) revert ExecutorHandoverNotReady(readyAt);
        emit NewExecutorAccepted(executor, msg.sender);
        executor = msg.sender;
        delete proposedExecutor;
    }

    /// @dev Who passes `onlyElevatedAccess`: the executor, unless an inheriting contract narrows it.
    function _isElevatedAccess(address caller) internal view virtual returns (bool) {
        return caller == executor;
    }

    modifier onlyElevatedAccess() {
        _requireElevatedAccess();
        _;
    }

    function _requireElevatedAccess() internal view {
        if (!_isElevatedAccess(msg.sender)) revert CommonEventsAndErrors.InvalidAccess();
    }
}
