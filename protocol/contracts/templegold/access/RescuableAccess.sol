pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/access/RescuableAccess.sol)

import { IExecutorAccess } from "contracts/interfaces/templegold/IExecutorAccess.sol";
import { IRescuableAccess } from "contracts/interfaces/templegold/IRescuableAccess.sol";
import { ExecutorAccess } from "contracts/templegold/access/ExecutorAccess.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

/// @title RescuableAccess
/// @notice See IRescuableAccess.
abstract contract RescuableAccess is IRescuableAccess, ExecutorAccess {
    /// @inheritdoc IRescuableAccess
    address public override rescuer;

    /// @inheritdoc IRescuableAccess
    address public override proposedRescuer;

    /// @inheritdoc IRescuableAccess
    bool public override inRescueMode;

    /// @dev Call once, from the inheriting contract's constructor or initializer.
    function _initRescuableAccess(address initialExecutor, address initialRescuer) internal {
        _initExecutorAccess(initialExecutor);
        if (initialRescuer == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        if (initialRescuer == initialExecutor) revert CommonEventsAndErrors.InvalidAddress();
        rescuer = initialRescuer;
    }

    /// @inheritdoc IRescuableAccess
    function setRescueMode(bool value) external override onlyRescuer {
        emit RescueModeSet(value);
        inRescueMode = value;
        // A pending proposal could come from a hijacked msig; cancel it so it can never be accepted.
        if (value) {
            if (proposedExecutor != address(0)) {
                emit NewExecutorProposed(executor, proposedExecutor, address(0));
                delete proposedExecutor;
            }
            _cancelPendingOnRescue();
        }
    }

    /// @dev Called when rescue mode switches on, after the executor proposal is cleared. Override to cancel
    /// other pending proposals.
    function _cancelPendingOnRescue() internal virtual {}

    /// @inheritdoc IRescuableAccess
    function proposeNewRescuer(address account) external override onlyRescuer {
        if (account == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        emit NewRescuerProposed(rescuer, proposedRescuer, account);
        proposedRescuer = account;
    }

    /// @inheritdoc IRescuableAccess
    function acceptRescuer() external override {
        if (msg.sender != proposedRescuer) revert CommonEventsAndErrors.InvalidAccess();
        if (msg.sender == executor) revert CommonEventsAndErrors.InvalidAddress();
        emit NewRescuerAccepted(rescuer, msg.sender);
        rescuer = msg.sender;
        delete proposedRescuer;
    }

    /// @inheritdoc IExecutorAccess
    /// @dev The rescuer can't accept.
    function acceptExecutor() external override(IExecutorAccess, ExecutorAccess) {
        if (msg.sender == rescuer) revert CommonEventsAndErrors.InvalidAddress();
        _acceptExecutor();
    }

    /// @dev Rescue mode locks the executor out of every `onlyElevatedAccess` function.
    function _isElevatedAccess(address caller) internal view virtual override returns (bool) {
        return !inRescueMode && super._isElevatedAccess(caller);
    }

    modifier onlyRescuer() {
        _onlyRescuer();
        _;
    }

    function _onlyRescuer() internal view {
        if (msg.sender != rescuer) revert CommonEventsAndErrors.InvalidAccess();
    }
}
