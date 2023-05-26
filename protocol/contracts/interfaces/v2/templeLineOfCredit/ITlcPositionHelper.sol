pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol)

import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";

interface ITlcPositionHelper is ITlcDataTypes {

    struct UserDebtPosition {
        uint256 debt;
        uint256 maxBorrow;
        uint256 healthFactor;
        uint256 loanToValueRatio;
    }

    struct UserPosition {
        uint256 collateralPosted;
        UserDebtPosition[2] debtPositions;
    }

    struct TotalPosition {
        /// @notice The DAI utilization rate as of the last checkpoint
        uint256 utilizationRatio;

        // @notice The DAI borrow interest rate as of the last checkpoint
        int256 borrowRate;

        // @notice The DAI total debt across all users as of this block
        uint256 totalDebt;
    }
}