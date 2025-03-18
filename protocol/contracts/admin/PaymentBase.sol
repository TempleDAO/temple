pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (admin/PaymentBase.sol)

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { IPaymentBase } from "contracts/interfaces/admin/IPaymentBase.sol";

abstract contract PaymentBase is IPaymentBase {
    using SafeERC20 for IERC20;

    /// @notice The owner of the TGLD funds
    address public override fundsOwner;
    /// @notice Payment token address
    IERC20 public paymentToken;

    /**
     * @notice Set funds owner
     * @param _fundsOwner Funds owner
     */
    function setFundsOwner(address _fundsOwner) public virtual {
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
    function recoverToken(address _token, address _to, uint256 _amount) public virtual {
        emit CommonEventsAndErrors.TokenRecovered(_to, _token, _amount);
        IERC20(_token).safeTransfer(_to, _amount);
    }

    /**
     * @notice Set payment token for fixed and epoch payments
     * @param _token Payment token 
     */
    function setPaymentToken(address _token) public virtual {
        if (_token == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        paymentToken = IERC20(_token);
        emit PaymentTokenSet(_token);
    }

    function _getElapsedTime(uint32 _start, uint32 _end, uint32 _duration) internal pure returns (uint32) {
        return _end - _start > _duration ? _duration : _end - _start;
    }
}