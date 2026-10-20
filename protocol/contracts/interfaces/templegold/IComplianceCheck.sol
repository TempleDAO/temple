pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/templegold/IComplianceCheck.sol)

import { IExecutorAccess } from "contracts/interfaces/templegold/IExecutorAccess.sol";
import { ITempleElevatedAccess } from "contracts/interfaces/v2/access/ITempleElevatedAccess.sol";

/// @title IComplianceCheck
/// @notice A list of blocked addresses, edited by the msig (executor) and the callers it grants `setBlocked` to.
/// One shared instance; auctions point at it and the msig can repoint them. A revert from `isBlocked` fails
/// closed: every screened call reverts with it.
interface IComplianceCheck is IExecutorAccess {
    event BlockedSet(address indexed account, bool blocked);
    event ExplicitAccessSet(address indexed account, bytes4 indexed fnSelector, bool indexed value);

    /// @notice Grant or revoke the functions in `access` for `allowedCaller`. A `proposeNewExecutor` grant hands
    /// over the executor role.
    /// @dev Executor only. Reverts on a zero `allowedCaller`.
    function setExplicitAccess(address allowedCaller, ITempleElevatedAccess.ExplicitAccess[] calldata access) external;

    /// @notice Block or unblock `accounts`. The executor, or a caller granted `setBlocked`.
    function setBlocked(address[] calldata accounts, bool value) external;

    /// @notice True if `account` may not deposit, withdraw or claim.
    function isBlocked(address account) external view returns (bool);

    /// @notice True if `allowedCaller` was granted `fnSelector` through `setExplicitAccess`.
    function explicitFunctionAccess(address allowedCaller, bytes4 fnSelector) external view returns (bool);
}
