pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/templegold/IComplianceCheck.sol)

import { IExecutorAccess } from "contracts/interfaces/templegold/IExecutorAccess.sol";

/// @title IComplianceCheck
/// @notice A list of flagged addresses, edited by the msig (executor) and the flaggers it adds.
/// One shared instance; auctions point at it and the msig can repoint them. A revert from `isFlagged` fails
/// closed: every screened call reverts with it.
interface IComplianceCheck is IExecutorAccess {
    event FlaggedSet(address indexed account, bool flagged);
    event FlaggerSet(address indexed account, bool flagger);

    /// @notice Add or remove `account` as a flagger. A flagger can edit the list, and exclude and reinstate bidders
    /// and pause on every auction pointing at this list, outside that auction's rescue mode, while compliance is
    /// enabled on it. It can't add flaggers or propose an executor. Flaggers are trusted: the executor picks and removes them.
    /// @dev Executor only. Reverts on a zero `account`.
    function setFlagger(address account, bool value) external;

    /// @notice Flag or unflag `accounts`. The executor or a flagger.
    function setFlagged(address[] calldata accounts, bool value) external;

    /// @notice True if `account` may not deposit, withdraw, claim or withdraw an excluded balance, and can be excluded.
    function isFlagged(address account) external view returns (bool);

    /// @notice True if `account` is a flagger.
    function isFlagger(address account) external view returns (bool);
}
