pragma solidity 0.8.18;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/templeLineOfCredit/ITlcEventsAndErrors.sol)

interface ITlcEventsAndErrors {
    error ExceededMaxLtv(uint256 collateralAmount, uint256 collateralValue, uint256 currentDaiDebt);
    error ExceededBorrowedAmount(uint256 totalDebtAmount, uint256 repayAmount);
    error InsufficientAmount(uint256 required, uint256 provided);
    error Paused();

    event TlcStrategySet(address indexed strategy, address indexed treasuryReservesVault);
    event InterestRateModelSet(address indexed interestRateModel);
    event MaxLtvRatioSet(uint256 maxLtvRatio);
    event CollateralAdded(address indexed fundedBy, address indexed onBehalfOf, uint256 collateralAmount);
    event CollateralRemoved(address indexed account, address indexed recipient, uint256 collateralAmount);
    event Borrow(address indexed account, address indexed recipient, uint256 amount);
    event Repay(address indexed fundedBy, address indexed onBehalfOf, uint256 repayAmount);
    event Liquidated(address indexed account, uint256 collateralSeized, uint256 collateralValue, uint256 daiDebtWiped);
    event InterestRateUpdate(uint96 newInterestRate);
    event BorrowPausedSet(bool isPaused);
}
