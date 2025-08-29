pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/admin/IPaymentBase.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPaymentBase {
    event FundsOwnerSet(address indexed fundOwner);
    event PaymentTokenSet(address token);

    error NotImplemented();

    /// @notice The owner of the payment asset funds
    function fundsOwner() external view returns(address);

    /// @notice Payment token address
    function paymentToken() external view returns(IERC20);

    /**
    * @notice Set funds owner
    * @param _fundsOwner Funds owner
    */
    function setFundsOwner(address _fundsOwner) external;

    /**
     * @notice Recover ERC20 token
     * @param _token Token address
     * @param _to Recipient address
     * @param _amount Amount to recover
     */
    function recoverToken(address _token, address _to, uint256 _amount) external;
}
