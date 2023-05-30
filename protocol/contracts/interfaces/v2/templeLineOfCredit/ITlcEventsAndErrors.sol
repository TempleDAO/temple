pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol)

import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";

interface ITlcEventsAndErrors {
    error ExceededMaxLtv();
    error UnknownFailure();

    error ExceededBorrowedAmount(address token, uint256 totalDebtAmount, uint256 repayAmount);
    error NotInFundsRequestWindow(uint32 requestedAt, uint32 windowMinSecs, uint32 windowMaxSecs);

    event TlcStrategySet(address indexed strategy);
    event FundsRequestWindowSet(uint256 minSecs, uint256 maxSecs);

    event CollateralAdded(address indexed fundedBy, address indexed onBehalfOf, uint256 collateralAmount);
    event CollateralRemoved(address indexed account, address indexed recipient, uint256 collateralAmount);

    event RemoveCollateralRequested(address indexed account, uint256 amount);
    event RemoveCollateralRequestCancelled(address indexed account);

    event BorrowRequested(address indexed account, ITlcDataTypes.TokenType tokenType, uint256 amount);
    event BorrowRequestCancelled(address indexed account, ITlcDataTypes.TokenType tokenType);
    event Borrow(address indexed account, address indexed recipient, ITlcDataTypes.TokenType tokenType, uint256 amount);

    event Repay(address indexed fundedBy, address indexed onBehalfOf, ITlcDataTypes.TokenType tokenType, uint256 repayAmount);

    event Liquidated(address indexed account, address indexed unhealthyDebtToken, uint256 healthFactor, uint256 debtAmount, uint256 collateralSeized);

    event InterestRateUpdate(address indexed token, int96 newInterestRate);

}
