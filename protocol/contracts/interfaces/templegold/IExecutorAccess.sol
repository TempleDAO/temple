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

    /// @notice Propose `account` as the next executor; it must then call `acceptExecutor`. The executor, or a caller
    /// granted it where grants exist; locked in rescue mode where there is one. Reverts on zero.
    function proposeNewExecutor(address account) external;

    /// @notice The proposed executor takes the role.
    function acceptExecutor() external;

    /// @notice The address approved to run normal operations on behalf of the DAO.
    function executor() external view returns (address);

    /// @notice The address proposed as the next executor. Zero means none.
    function proposedExecutor() external view returns (address);
}
