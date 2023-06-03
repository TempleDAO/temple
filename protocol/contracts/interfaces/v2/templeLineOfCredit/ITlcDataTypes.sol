pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol)

import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITlcDataTypes {
    struct DebtTokenConfig {
        /// @notice The interest rate model contract
        IInterestRateModel interestRateModel;

        /// @notice Maximum Loan To Value (LTV) ratio to prevent liquidation
        uint128 maxLtvRatio;

        FundsRequestWindow borrowRequestWindow;
    }

    struct DebtTokenData {
        // Packed slot: 32 + 128 + 96 = 256

        /// @notice The last time the debt was updated for this token
        uint32 interestAccumulatorUpdatedAt;

        /// @notice Total amount that has already been borrowed, which increases as interest accrues
        uint128 totalDebt;

        /// @notice The interest rate as of the last borrow/repay/
        uint96 interestRate;

        uint256 interestAccumulator;
    }

    struct DebtTokenDetails {
        DebtTokenConfig config;
        DebtTokenData data;
    }

    struct FundsRequestWindow {
        uint32 minSecs;
        uint32 maxSecs;
    }

    struct WithdrawFundsRequest {
        uint128 amount;
        uint32 requestedAt;
    }

    struct AccountDebtData {
        uint128 debtCheckpoint;
        WithdrawFundsRequest borrowRequest;
        uint128 interestAccumulator;
    }

    struct AccountData {
        uint256 collateralPosted;
        WithdrawFundsRequest removeCollateralRequest;
        mapping(IERC20 => AccountDebtData) debtData;
    }

    struct LiquidityStatus {
        // True if either DAI or OUD has exceeded the max LTV
        bool hasExceededMaxLtv;

        uint256 collateral;
        uint256 currentDaiDebt;
        uint256 currentOudDebt;
    }
    
    struct AccountDebtPosition {
        uint256 currentDebt;
        uint256 maxBorrow;
        uint256 healthFactor;
        uint256 loanToValueRatio;
    }

    struct AccountPosition {
        uint256 collateralPosted;
        AccountDebtPosition daiDebtPosition;
        AccountDebtPosition oudDebtPosition;
    }

    struct TotalPosition {
        /// @notice The DAI utilization rate as of the last checkpoint
        uint256 utilizationRatio;

        // @notice The DAI borrow interest rate as of the last checkpoint
        uint256 borrowRate;

        // @notice The DAI total debt across all accounts as of this block
        uint256 totalDebt;
    }
}
