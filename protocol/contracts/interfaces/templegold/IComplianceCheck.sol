pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/templegold/IComplianceCheck.sol)

import { IExecutorAccess } from "contracts/interfaces/templegold/IExecutorAccess.sol";

/// @title IComplianceCheck
/// @notice A list of blocked addresses, edited by the msig (executor) and the blockers it appoints.
/// One shared instance; auctions point at it and the msig can repoint them. A revert from `isBlocked` fails
/// closed: every screened call reverts with it.
interface IComplianceCheck is IExecutorAccess {
    event BlockedSet(address indexed account, bool blocked);
    event BlockerSet(address indexed account, bool blocker);

    /// @notice Appoint or remove `account` as a blocker. A blocker can edit the list, and can exclude and reinstate
    /// bidders on every auction pointing at this list, outside that auction's rescue mode, while compliance is enabled
    /// on it. It can't change the executor or appoint blockers. Blockers are trusted: the executor picks and removes
    /// them.
    /// @dev Executor only. Reverts on a zero `account`.
    function setBlocker(address account, bool value) external;

    /// @notice Block or unblock `accounts`. The executor or a blocker.
    function setBlocked(address[] calldata accounts, bool value) external;

    /// @notice True if `account` may not deposit, withdraw, claim or withdraw an excluded balance, and can be excluded.
    function isBlocked(address account) external view returns (bool);

    /// @notice True if `account` is a blocker.
    function isBlocker(address account) external view returns (bool);
}
