pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/SafeGuards/ThresholdSafeGuard.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { GnosisSafe } from "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import { Enum } from "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";

import { IThresholdSafeGuard } from "contracts/interfaces/v2/safeGuards/IThresholdSafeGuard.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { SafeForked } from "contracts/v2/safeGuards/SafeForked.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";

/**
  * @title Threshold Safe Guard
  * @notice This Safe Guard performs two pre-execute checks:
  *    1/ The safeTxExecutor is a safe owner or a pre-approved executor
  *    2/ The number of signers is >= a per contract/function defined threshold
  *       (or a default threshold if not explicitly set per contract/function)
 */
contract ThresholdSafeGuard is IThresholdSafeGuard, TempleElevatedAccess {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    string public constant VERSION = "1.0.0";
    
    /**
      * @notice Break-glass to disable this guard such that the default Safe behaviour is resumed.
      * Only the Owner is allowed to disable. Never set the owner to the same safe which this is guarding
      * as it could be bricked.
     */
    bool public override disableGuardChecks;

    /**
     * @notice The required number of signatures required by default for all transactions.
     */
    uint256 public override defaultSignaturesThreshold;
    
    /**
      * @notice Per contract and function override of required signature thresholds on the Safe.
      * If not explicitly set for a contract/function, then the `defaultSignaturesThreshold` is used.
      * If the threshold is less than the builtin Safe threshold, no signature checks are performed 
      * in this guard -- the Safe has already verified the signers.
      */
    mapping(address => mapping(bytes4 => uint256)) public override functionThresholds;

    /**
     * @notice The required signature thresholds for ETH transfers.
     */
    mapping(address => uint256) public override ethTransferThresholds;

    /**
      * @notice Approved addresses which are allowed to execute approved transactions
      * Safe owners are also allowed to execute.
     */
    EnumerableSet.AddressSet internal _safeTxExecutors;

    constructor(address _initialRescuer, address _initialExecutor, uint256 _defaultSignaturesThreshold) 
        TempleElevatedAccess(_initialRescuer, _initialExecutor)
    {
        defaultSignaturesThreshold = _defaultSignaturesThreshold;
    }

    /**
     * @notice Disable the Safe Guard, so all transactions pass if the Gnosis threshold of signers is met.
     *   1. Rescuers setRescueMode(true)
     *   2. Rescuers setDisableGuardChecks(true)
     * Note: Rescuers won't have a Guard on their multisig, so this can't be bricked.
     */
    function setDisableGuardChecks(bool value) external onlyInRescueMode {
        disableGuardChecks = value;
        emit DisableGuardChecksSet(value);
    }

    /**
      * @notice Add an address to the allowed list who can execute the transaction
      * once the minimum threshold of signers have approved
     */
    function addSafeTxExecutor(address account) external onlyElevatedAccess {
        if (account == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        emit SafeTxExecutorAdded(account);
        if (!_safeTxExecutors.add(account)) revert InvalidExecutor();
    }

    /**
      * @notice Remove an address from the allowed list who can execute the transaction
      * once the minimum threshold of signers have approved
     */
    function removeSafeTxExecutor(address account) external onlyElevatedAccess {
        if (account == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        emit SafeTxExecutorRemoved(account);
        if (!_safeTxExecutors.remove(account)) revert InvalidExecutor();
    }

    /**
      * @notice Set the default number of signatories required, when a contract/function signature
      * not explicitly defined.
     */
    function setDefaultSignaturesThreshold(uint256 threshold) external onlyElevatedAccess {
        emit DefaultSignaturesThresholdSet(threshold);
        defaultSignaturesThreshold = threshold;
    }

    /**
      * @notice Set the number of signatories required for a contract/function signature pair.
      * @dev functionSignature=bytes(0) is ok as this represents an ETH transfer which may also have
      * an explicit threshold.
     */
    function setFunctionThreshold(address contractAddr, bytes4 functionSignature, uint256 threshold) external onlyElevatedAccess {
        if (contractAddr == address(0)) revert CommonEventsAndErrors.InvalidAddress();

        emit FunctionThresholdSet(contractAddr, functionSignature, threshold);
        functionThresholds[contractAddr][functionSignature] = threshold;
    }

    /**
      * @notice Set the number of signatories required for a number of function signatures at a time.
     */
    function setFunctionThresholdBatch(address contractAddr, bytes4[] memory functionSignatures, uint256 threshold) external onlyElevatedAccess {
        if (contractAddr == address(0)) revert CommonEventsAndErrors.InvalidAddress();

        uint256 length = functionSignatures.length;
        bytes4 sig;
        for (uint256 i; i < length; ++i) {
            sig = functionSignatures[i];
            emit FunctionThresholdSet(contractAddr, sig, threshold);
            functionThresholds[contractAddr][sig] = threshold;
        }
    }

    /**
      * @notice Set the number of signatories required for a contract/function signature pair.
      * @dev functionSignature=bytes(0) is ok as this represents an ETH transfer which may also have
      * an explicit threshold.
     */
    function setEthTransferThreshold(address contractAddr, uint256 threshold) external onlyElevatedAccess {
        if (contractAddr == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        emit EthTransferThresholdSet(contractAddr, threshold);
        ethTransferThresholds[contractAddr] = threshold;
    }

    /**
      * @notice The set of extra addresses (along with the Safe owners) allowed to execute
      * the transaction once the minimum threshold of signers have approved
     */
    function safeTxExecutors() external view returns (address[] memory executors) {
        return _safeTxExecutors.values();
    }

    /**
      * @notice The required signatory threshold for a given contract and functionSignature
     */
    function getThreshold(address contractAddr, bytes4 fnSignature) public view returns (uint256) {
        uint256 threshold = functionThresholds[contractAddr][fnSignature];
        return threshold > 0 ? threshold : defaultSignaturesThreshold;
    }

    /**
      * @notice The required signatory threshold for a given contract and functionSignature
     */
    function getEthTransferThreshold(address contractAddr) public view returns (uint256) {
        uint256 threshold = ethTransferThresholds[contractAddr];
        return threshold > 0 ? threshold : defaultSignaturesThreshold;
    }

    /**
      * @notice The Safe will call this method once the signatories has been checked vs Safe's builtin threshold.
      * This will revert:
      *    1/ If the safeTxExecutor is not either a safe owner or pre-approved executor
      *    2/ The number of signers does not meet a per contract/function defined threshold
      *       (or a default threshold if not explicitly set per contract/function)
      * 
      * Exceptions:
      *    a/ If the builtin Safe's threshold == 1, the number of signatories here isn't checked. 
      *       So the proposer can execute immediately. 
      *       This is to handle Tenderly transaction simulations via the dapp.
      *    b/ If number of signers for the contract/function is less than the safe threshold - then no extra
      *       signatory checks are done here, as it's already been done in the Safe.
     */
    function checkTransaction(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        // solhint-disable-next-line no-unused-vars
        address payable refundReceiver,
        bytes memory signatures,
        address safeTxExecutor
    ) external view {
        // Circuit breaker
        if (disableGuardChecks) return;

        GnosisSafe safe = GnosisSafe(payable(msg.sender));

        if (!(_safeTxExecutors.contains(safeTxExecutor) || safe.isOwner(safeTxExecutor))) {
            revert InvalidExecutor();
        }

        uint256 threshold;
        {
            uint256 safeThreshold = safe.getThreshold();

            // When Tenderly simulations run, the Safe's threshold is overriden to 1.
            // So only check the signatures when the threshold is > 1
            // WARNING: This means that we aren't doing any extra checks if the Safe's threshold == 1. It should always be > 1
            // Note - if multiple signers have already signed, then the Safe dapp doesn't do this override. So it may still fail if
            //        number of signers == 1 < x < dynamicThresholdRequirement
            if (safeThreshold == 1) return;

            // If the data length is 0, this means it's a native ETH transfer. In this case use the `ETH_TRANSFER_SELECTOR` selector
            // Perhaps in future there could be some custom decoding/approvals based on the arguments too
            threshold = data.length == 0 
                ? getEthTransferThreshold(to)
                : getThreshold(to, bytes4(data));

            // No need for extra threshold checks - it already has the required signers, because we know Safe
            // has checked these already prior to calling the guard.
            if (safeThreshold >= threshold) return;
        }

        // Check the signatures for the function being called.
        {
            bytes memory txHashData = safe.encodeTransactionData(
                to, 
                value, 
                data, 
                operation, 
                safeTxGas, 
                baseGas, 
                gasPrice, 
                gasToken, 
                refundReceiver, 
                safe.nonce() - 1 // Remove one from the nonce, as the Safe.execTransaction increased it prior to calling the guard.
            );
            SafeForked.checkNSignatures(safeTxExecutor, safe, keccak256(txHashData), txHashData, signatures, threshold);
        }
    }

    /// @notice unused
    // solhint-disable-next-line no-empty-blocks
    function checkAfterExecution(bytes32, bool) external view {}

    // solhint-disable-next-line payable-fallback
    fallback() external {
        // We don't revert on fallback to avoid issues in case of a Safe upgrade
        // E.g. The expected check method might change and then the Safe would be locked.
    }

    /**
      * @notice Governance can recover any token from the strategy.
     */
    function recoverToken(address token, address to, uint256 amount) external onlyElevatedAccess {
        emit CommonEventsAndErrors.TokenRecovered(to, token, amount);
        IERC20(token).safeTransfer(to, amount);
    }
}