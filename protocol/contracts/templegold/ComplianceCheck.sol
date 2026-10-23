pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/ComplianceCheck.sol)

import { IComplianceCheck } from "contracts/interfaces/templegold/IComplianceCheck.sol";
import { ExecutorAccess } from "contracts/templegold/access/ExecutorAccess.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

/// @title ComplianceCheck
/// @notice See IComplianceCheck.
contract ComplianceCheck is IComplianceCheck, ExecutorAccess {
    /// @inheritdoc IComplianceCheck
    mapping(address account => bool blocked) public override isBlocked;

    /// @inheritdoc IComplianceCheck
    mapping(address account => bool blocker) public override isBlocker;

    constructor(address initialExecutor) {
        _initExecutorAccess(initialExecutor);
    }

    /// @inheritdoc IComplianceCheck
    function setBlocker(address account, bool value) external override onlyElevatedAccess {
        if (account == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        emit BlockerSet(account, value);
        isBlocker[account] = value;
    }

    /// @inheritdoc IComplianceCheck
    function setBlocked(address[] calldata accounts, bool value) external override {
        if (msg.sender != executor && !isBlocker[msg.sender]) revert CommonEventsAndErrors.InvalidAccess();
        for (uint256 i; i < accounts.length; ++i) {
            emit BlockedSet(accounts[i], value);
            isBlocked[accounts[i]] = value;
        }
    }
}
