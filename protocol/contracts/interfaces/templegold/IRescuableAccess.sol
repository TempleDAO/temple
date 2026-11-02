pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/templegold/IRescuableAccess.sol)

import { IExecutorAccess } from "contracts/interfaces/templegold/IExecutorAccess.sol";

/// @title IRescuableAccess
/// @notice A rescuer beside the executor (msig). Rescue mode locks the msig out; the implementing contract
/// decides what the rescuer may do.
interface IRescuableAccess is IExecutorAccess {
    /// @dev Same signature as `ITempleElevatedAccess.RescueModeSet`, so one ABI decodes both.
    event RescueModeSet(bool indexed value);
    event NewRescuerProposed(
        address indexed oldRescuer,
        address indexed oldProposedRescuer,
        address indexed newProposedRescuer
    );
    event NewRescuerAccepted(address indexed oldRescuer, address indexed newRescuer);

    /// @notice Switch rescue mode on or off. Rescuer only. Switching it on also cancels any pending executor proposal.
    /// Rescue mode is per contract.
    function setRescueMode(bool value) external;

    /// @notice Propose `account` as the next rescuer. It must then call `acceptRescuer`. Rescuer only; reverts on
    /// zero.
    function proposeNewRescuer(address account) external;

    /// @notice The proposed rescuer takes the role. Reverts if the caller is the executor.
    function acceptRescuer() external;

    /// @notice A guardian held by a separate multisig, with narrow powers the msig can't change.
    function rescuer() external view returns (address);

    /// @notice The address proposed as the next rescuer. Zero means none.
    function proposedRescuer() external view returns (address);

    /// @notice While true, the executor can't call any onlyElevatedAccess function.
    function inRescueMode() external view returns (bool);
}
