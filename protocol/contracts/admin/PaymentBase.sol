pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (admin/PaymentBase.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IPaymentBase } from "contracts/interfaces/admin/IPaymentBase.sol";

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";


abstract contract PaymentBase is IPaymentBase {
    using SafeERC20 for IERC20;

    /// @inheritdoc IPaymentBase
    address public override fundsOwner;

    /// @inheritdoc IPaymentBase
    IERC20 public immutable paymentToken;

    constructor(address _paymentToken) {
        if (_paymentToken == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        paymentToken = IERC20(_paymentToken);
    }

    /**
     * @notice Set funds owner
     * @param _fundsOwner Funds owner
     */
    function _setFundsOwner(address _fundsOwner) internal {
        if (_fundsOwner == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        /// @dev Elevated access should revoke approval from old `fundsOwner` for this contract
        fundsOwner = _fundsOwner;
        emit FundsOwnerSet(_fundsOwner);
    }

    /**
     * @notice Recover ERC20 token
     * @param _token Token address
     * @param _to Recipient address
     * @param _amount Amount to recover
     */
    function _recoverToken(address _token, address _to, uint256 _amount) internal {
        emit CommonEventsAndErrors.TokenRecovered(_to, _token, _amount);
        IERC20(_token).safeTransfer(_to, _amount);
    }

    function _getElapsedTime(uint40 _start, uint40 _end, uint40 _duration) internal pure returns (uint40) {
        if (_end <= _start) {
            return 0;
        }
        uint40 elapsed = _end - _start;
        return elapsed > _duration ? _duration : elapsed;
    }
}