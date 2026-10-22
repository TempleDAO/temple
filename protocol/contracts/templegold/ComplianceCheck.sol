pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/ComplianceCheck.sol)

import { IComplianceCheck } from "contracts/interfaces/templegold/IComplianceCheck.sol";
import { ITempleElevatedAccess } from "contracts/interfaces/v2/access/ITempleElevatedAccess.sol";
import { ExecutorAccess } from "contracts/templegold/access/ExecutorAccess.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

/// @title ComplianceCheck
/// @notice See IComplianceCheck.
contract ComplianceCheck is IComplianceCheck, ExecutorAccess {
    /// @inheritdoc IComplianceCheck
    mapping(address account => bool flagged) public override isFlagged;

    /// @inheritdoc IComplianceCheck
    mapping(address allowedCaller => mapping(bytes4 fnSelector => bool allowed)) public override
        explicitFunctionAccess;

    constructor(address initialExecutor) {
        _initExecutorAccess(initialExecutor);
    }

    /// @inheritdoc IComplianceCheck
    /// @dev Checks the executor directly, not `onlyElevatedAccess`, so no explicit grant reaches this function.
    function setExplicitAccess(
        address allowedCaller,
        ITempleElevatedAccess.ExplicitAccess[] calldata access
    ) external override {
        if (msg.sender != executor) revert CommonEventsAndErrors.InvalidAccess();
        if (allowedCaller == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        for (uint256 i; i < access.length; ++i) {
            emit ExplicitAccessSet(allowedCaller, access[i].fnSelector, access[i].allowed);
            explicitFunctionAccess[allowedCaller][access[i].fnSelector] = access[i].allowed;
        }
    }

    /// @inheritdoc IComplianceCheck
    function setFlagged(address[] calldata accounts, bool value) external override onlyElevatedAccess {
        for (uint256 i; i < accounts.length; ++i) {
            emit FlaggedSet(accounts[i], value);
            isFlagged[accounts[i]] = value;
        }
    }

    /// @dev The executor, or a caller explicitly granted the function.
    function _isElevatedAccess(address caller, bytes4 fnSelector) internal view override returns (bool) {
        return super._isElevatedAccess(caller, fnSelector) || explicitFunctionAccess[caller][fnSelector];
    }
}
