pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

/// @notice The same functionality as OZ's TimelockController, except it also bubbles
/// up the revert string if there's an underlying issue on execution.
contract DummyTimelockController is TimelockController {
    error UnknownExecuteError(bytes result);
    
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(minDelay, proposers, executors, admin) {}

    /**
     * @dev Execute an operation's call.
     */
    function _execute(
        address target,
        uint256 value,
        bytes calldata data
    ) internal override {
        (bool success, bytes memory returndata) = target.call{value: value}(data);

        if (success) {
            return;
        } else if (returndata.length != 0) {
            // Look for revert reason and bubble it up if present
            // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/Address.sol#L232
            assembly {
                let returndata_size := mload(returndata)
                revert(add(32, returndata), returndata_size)
            }
        } else {
            revert UnknownExecuteError(returndata);
        }
    }

}
