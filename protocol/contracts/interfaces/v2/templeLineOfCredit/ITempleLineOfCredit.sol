pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol)

import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";
import { ITlcEventsAndErrors } from "contracts/interfaces/v2/templeLineOfCredit/ITlcEventsAndErrors.sol";

interface ITempleLineOfCredit is ITlcDataTypes, ITlcEventsAndErrors {
    // error InsufficentCollateral();

    // event RemoveCollateralRequested(address indexed account, uint256 amount);
    // event RemoveCollateralRequestCancelled(address indexed account);

    // event BorrowRequested(address indexed account, TokenType tokenType, uint256 amount);
    // event BorrowRequestCancelled(address indexed account, TokenType tokenType);

    // // event FundsRequested(address indexed account, FundsRequestType requestType, uint256 amount);
    // // event FundsRequestedCancelled(address indexed account, FundsRequestType requestType);

    // event CollateralAdded(address indexed fundedBy, address indexed onBehalfOf, uint256 collateralAmount);
    // event CollateralRemoved(address indexed account, address indexed recipient, uint256 collateralAmount);

    // event WithdrawCollateralCooldownSecsSet(uint256 cooldownSecs);
    // event BorrowCooldownSecsSet(TokenType tokenType, uint256 cooldownSecs);



    // event Borrow(address indexed account, address indexed recipient, TokenType tokenType, uint256 amount);
    // event Repay(address indexed fundedBy, address indexed onBehalfOf, TokenType tokenType, uint256 repayAmount);

    // event Liquidated(address indexed account, address indexed unhealthyDebtToken, uint256 healthFactor, uint256 debtAmount, uint256 collateralSeized);

    // @todo add all functions, then add override in TempleLineOfCredit
}
