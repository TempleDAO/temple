pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";

interface ITlcDataTypes {
    /// @notice Configuration of the Debt Tokens (DAI | OUD)
    struct DebtTokenConfig {
        /// @notice Maximum Loan To Value (LTV) ratio to prevent liquidation
        uint128 maxLtvRatio;

        /// @notice The borrow interest rate model contract
        IInterestRateModel interestRateModel;

        /// @notice The min/max seconds after a borrow request in which the borrow action 
        /// can then be performed
        FundsRequestWindow borrowRequestWindow;
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

    /// @notice The Debt Token config and latest checkpoint data.
    struct DebtTokenDetails {
        DebtTokenConfig config;
        DebtTokenData data;
    }

    /// @notice The min/max seconds after a borrow or collateral removal request
    /// in which the borrow action can then be performed
    struct FundsRequestWindow {
        /// @notice The minimum numer of seconds after a request has been made before the action can be done
        uint32 minSecs;

        /// @notice The maximum number of seconds after a request has been made before the request expires.
        uint32 maxSecs;
    }

    /// @notice The amount and time when a borrow or collateral withdrawal
    /// request was made.
    struct WithdrawFundsRequest {
        uint128 amount;
        uint32 requestedAt;
    }

    /// @notice The latest checkopint of debt, the users interest accumulator
    /// and borrow requests.
    struct AccountDebtData {
        uint128 debtCheckpoint;
        uint128 interestAccumulator;
        WithdrawFundsRequest borrowRequest;
    }

    /// @notice An account's record of collateral posted, requests
    /// and debt data for DAI and OUD
    struct AccountData {
        uint256 collateralPosted;
        WithdrawFundsRequest removeCollateralRequest;
        mapping(IERC20 => AccountDebtData) debtData;
    }

    /// @notice The status for an account whether it can be liquidated or not
    struct LiquidationStatus {
        /// @notice True if either DAI or OUD has exceeded the max LTV
        bool hasExceededMaxLtv;

        /// @notice The amount (not the value) of collateral which has been provided by the user
        uint256 collateral;

        /// @notice The amount of DAI debt as of this block
        uint128 currentDaiDebt;

        /// @notice The amount of OUD debt as of this block
        uint128 currentOudDebt;
    }
    
    /// @notice An account's debt position for either DAI or OUD
    struct AccountDebtPosition {
        uint256 currentDebt;
        uint256 maxBorrow;
        uint256 healthFactor;
        uint256 loanToValueRatio;
    }

    /// @notice An account's collateral and debt for both DAI and OUD
    struct AccountPosition {
        uint256 collateralPosted;
        AccountDebtPosition daiDebtPosition;
        AccountDebtPosition oudDebtPosition;
    }

    /// @noice The total debt position metrics for either DAI or OUD
    struct TotalDebtPosition {
        /// @notice The utilization rate as of the last checkpoint
        uint256 utilizationRatio;

        // @notice The borrow interest rate as of the last checkpoint
        uint256 borrowRate;

        // @notice The total debt across all accounts as of this block
        uint256 totalDebt;
    }
}
