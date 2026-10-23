pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/templegold/IExecutorAccess.sol)

/// @title IExecutorAccess
/// @notice A single executor (the team msig) with a two-step handover.
interface IExecutorAccess {
    /// @notice A zero newProposedExecutor means the proposal was cancelled (rescue mode switched on).
    event NewExecutorProposed(
        address indexed oldExecutor,
        address indexed oldProposedExecutor,
        address indexed newProposedExecutor
    );
    event NewExecutorAccepted(address indexed oldExecutor, address indexed newExecutor);

    /// @dev `acceptExecutor` was called before `readyAt`.
    error ExecutorHandoverNotReady(uint256 readyAt);

    /// @notice Propose `account` as the next executor; it must then call `acceptExecutor`. The executor only; locked in
    /// rescue mode where there is one. Reverts on zero. Restarts the `EXECUTOR_HANDOVER_DELAY` clock.
    function proposeNewExecutor(address account) external;

    /// @notice The proposed executor takes the role, no sooner than `EXECUTOR_HANDOVER_DELAY` after the proposal.
    /// Where there is a rescue mode, switching it on during the delay cancels the proposal.
    /// ComplianceCheck has none; there the executor can re-propose during the delay to overwrite the proposal.
    function acceptExecutor() external;

    /// @notice The address approved to run normal operations on behalf of the DAO.
    function executor() external view returns (address);

    /// @notice The address proposed as the next executor. Zero means none.
    function proposedExecutor() external view returns (address);

    /// @notice When the latest executor proposal was made, in unix seconds. Not cleared on accept or cancel.
    function proposedExecutorAt() external view returns (uint40);

    /// @notice How long a proposed executor waits before it can accept.
    function EXECUTOR_HANDOVER_DELAY() external view returns (uint256);
}
