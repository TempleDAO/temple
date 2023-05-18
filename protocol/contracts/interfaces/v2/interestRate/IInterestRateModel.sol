pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/interestRate/ITempleDebtToken.sol)

interface IInterestRateModel {
    /**
     * @notice Get the current borrow rate, based on the utilisation ratio (totallBorrow/totalReserve)
     * @dev Not all models will require all params.
     */
    function getBorrowRate(
        uint256 totalBorrow, 
        uint256 totalReserve
    ) external view returns (uint256);
}