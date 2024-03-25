pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol)

import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";

interface ITlcDataTypes {
    /// @notice Configuration of the DAI Debt Token
    struct DebtTokenConfig {
        /// @notice Maximum Loan To Value (LTV) ratio an account can have before being liquidated
        uint96 maxLtvRatio;

        /// @notice The borrow interest rate model contract
        IInterestRateModel interestRateModel;

        /// @notice Pause new borrows
        bool borrowsPaused;
    }

    /// @notice The latest checkpoint of Debt Token data
    /// @dev Packed slot: 32 + 128 + 96 = 256
    struct DebtTokenData {
        /// @notice The last time the debt was updated for this token
        uint32 interestAccumulatorUpdatedAt;

        /// @notice Total amount of debt which has been borrowed across all users
        uint128 totalDebt;

        /// @notice The last calculated borrow interest rate
        uint96 interestRate;

        /// @notice The accumulator index used to track the compounding of debt.
        uint256 interestAccumulator;
    }

    /// @notice The record of an account's collateral, requests
    /// and DAI debt data
    /// @dev Packed slots: (128 + 128), (128 + 128), (128 +  64 + 64)
    struct AccountData {
        /// @notice The amount of collateral the account has posted
        uint128 collateral;
        
        /** 
         * @notice A checkpoint of user debt, updated after a borrow/repay/liquidation
         * @dev Debt as of now =  (
         *    `account.debtCheckpoint` *
         *    `debtTokenData.interestAccumulator` / 
         *    `account.interestAccumulator`
         * )
         */
        uint128 debtCheckpoint;

        /// @notice The account's last interest accumulator checkpoint
        uint256 interestAccumulator;
    }

    /// @notice The status for whether an account can be liquidated or not
    struct LiquidationStatus {
        /// @notice True if the DAI borrow position has exceeded the max LTV
        /// in which case it can be liquidated
        bool hasExceededMaxLtv;

        /// @notice The amount of collateral which has been provided by the user
        uint128 collateral;

        /// @notice The value of collateral (amount * TPI) which has been provided by the user
        uint256 collateralValue;

        /// @notice The amount of DAI debt as of this block
        uint128 currentDebt;
    }
    
    /// @notice An account's collateral and DAI debt position
    struct AccountPosition {
        /// @notice The amount (not the value) of collateral which has been provided by the user
        uint128 collateral;

        /// @notice The amount of DAI debt as of this block
        uint128 currentDebt;

        /// @notice The maximum amount this account can borrow given the collateral posted.
        /// @dev Note if this max is actually borrowed then it will immediately be liquidated as 1 block
        /// of interest will tip it over the max allowed LTV
        uint128 maxBorrow;

        /// @notice The health factor of this accounts position. Anything less than 1 can be liquidated.
        uint256 healthFactor;

        /// @notice The current LTV ratio of this account
        uint256 loanToValueRatio;
    }

    /// @notice The total DAI debt position metrics across all accounts
    struct TotalDebtPosition {
        /// @notice The utilization rate as of the last checkpoint
        uint256 utilizationRatio;

        // @notice The borrow interest rate as of the last checkpoint
        uint256 borrowRate;

        // @notice The total debt across all accounts as of this block
        uint256 totalDebt;
    }
}
