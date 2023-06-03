pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol)

import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";

interface ITlcEventsAndErrors {
    error ExceededMaxLtv(uint256 collateral, uint256 currentDaiDebt, uint256 currentOudDebt);
    error UnknownFailure();

    error ExceededBorrowedAmount(address token, uint256 totalDebtAmount, uint256 repayAmount);
    error NotInFundsRequestWindow(uint256 currentTimestamp, uint32 requestedAt, uint32 windowMinSecs, uint32 windowMaxSecs);

    event TlcStrategySet(address indexed strategy, address indexed treasuryReservesVault);
    event FundsRequestWindowSet(uint256 minSecs, uint256 maxSecs);
    event InterestRateModelSet(address indexed token, address indexed interestRateModel);
    event MaxLtvRatioSet(address indexed token, uint256 maxLtvRatio);

    event CollateralAdded(address indexed fundedBy, address indexed onBehalfOf, uint256 collateralAmount);
    event CollateralRemoved(address indexed account, address indexed recipient, uint256 collateralAmount);

    event RemoveCollateralRequested(address indexed account, uint256 amount);
    event RemoveCollateralRequestCancelled(address indexed account);

    event BorrowRequested(address indexed account, address indexed token, uint256 amount);
    event BorrowRequestCancelled(address indexed account, address indexed token);
    event Borrow(address indexed account, address indexed recipient, address indexed token, uint256 amount);

    event Repay(address indexed fundedBy, address indexed onBehalfOf, address indexed token, uint256 repayAmount);

    event Liquidated(address indexed account, uint256 collateralSeized, uint256 daiDebtWiped, uint256 oudDebtWiped);

    event InterestRateUpdate(address indexed token, int96 newInterestRate);

}
