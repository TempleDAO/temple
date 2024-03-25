pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/SafeGuards/IThresholdSafeGuard.sol)

import { Guard } from "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";

interface IThresholdSafeGuard is Guard {
    event DisableGuardChecksSet(bool value);
    event DefaultSignaturesThresholdSet(uint256 threshold);
    event FunctionThresholdSet(address indexed contractAddr, bytes4 indexed functionSignature, uint256 threshold);
    event EthTransferThresholdSet(address indexed contractAddr, uint256 threshold);
    event SafeTxExecutorAdded(address indexed executor);
    event SafeTxExecutorRemoved(address indexed executor);

    error InvalidExecutor();
    error DynamicSignatureThresholdNotMet(uint256 required, uint256 found);

    /**
      * @notice Break-glass to disable this guard such that the default Safe behaviour is resumed.
      * Only the Owner is allowed to disable. Never set the owner to the same safe which this is guarding
      * as it could be bricked.
     */
    function disableGuardChecks() external view returns (bool);

    /**
     * @notice The required number of signatures required by default for all transactions.
     */
    function defaultSignaturesThreshold() external view returns (uint256);

    /**
      * @notice Per contract and function override of required signature thresholds on the Safe.
      * If not explicitly set for a contract/function, then the `defaultSignaturesThreshold` is used.
      * If the threshold is less than the builtin Safe threshold, no signature checks are performed 
      * in this guard -- the Safe has already verified the signers.
     */
    function functionThresholds(address contractAddr, bytes4 functionSignature) external view returns (uint256);

    /**
     * @notice The required signature thresholds for ETH transfers.
     */
    function ethTransferThresholds(address contractAddr) external view returns (uint256);
}