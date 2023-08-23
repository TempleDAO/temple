pragma solidity 0.8.19;
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
    event CollateralAdded(address indexed fundedBy, address indexed onBehalfOf, uint128 collateralAmount);
    event CollateralRemoved(address indexed account, address indexed recipient, uint128 collateralAmount);
    event Borrow(address indexed account, address indexed recipient, uint128 amount);
    event Repay(address indexed fundedBy, address indexed onBehalfOf, uint128 repayAmount);
    event Liquidated(address indexed account, uint128 collateralSeized, uint256 collateralValue, uint128 daiDebtWiped);
    event InterestRateUpdate(uint96 newInterestRate);
    event BorrowPausedSet(bool isPaused);
    event LiquidationsPausedSet(bool isPaused);
    event MinBorrowAmountSet(uint128 amount);
}
