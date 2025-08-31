pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (admin/PaymentBase.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IPaymentBase } from "contracts/interfaces/admin/IPaymentBase.sol";

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";

abstract contract PaymentBase is TempleElevatedAccess, IPaymentBase {
    using SafeERC20 for IERC20;

    /// @inheritdoc IPaymentBase
    address public override fundsOwner;

    /// @inheritdoc IPaymentBase
    IERC20 public immutable paymentToken;

    constructor(address _paymentToken, address _fundsOwner, address _rescuer, address _executor) TempleElevatedAccess(_rescuer, _executor) {
        if (_paymentToken == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        paymentToken = IERC20(_paymentToken);
        fundsOwner = _fundsOwner;
    }

    /// @inheritdoc IPaymentBase
    function setFundsOwner(address _fundsOwner) external override onlyElevatedAccess {
        if (_fundsOwner == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        /// @dev Elevated access should revoke approval from old `fundsOwner` for this contract
        fundsOwner = _fundsOwner;
        emit FundsOwnerSet(_fundsOwner);
    }

    /// @inheritdoc IPaymentBase
    function recoverToken(address _token, address _to, uint256 _amount) external override onlyElevatedAccess {
        emit CommonEventsAndErrors.TokenRecovered(_to, _token, _amount);
        IERC20(_token).safeTransfer(_to, _amount);
    }
}
