pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol)

import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITlcDataTypes {
    enum TokenPriceType {
        /// @notice equal to 1 USD
        STABLE,

        /// @notice Use the Treasury Price Index (TPI) from the Treasury Reserves Vault
        TPI
    }

    enum InterestRateModelType {
        /// @notice Use a single flat price
        FLAT,

        /// @notice Interest rate based off a 
        TRV_UTILIZATION_RATE
    }

    // @todo byte pack all of these
    struct ReserveTokenConfig {
        /// @notice The type of how to lookup the price of the token
        TokenPriceType tokenPriceType;

        /// @notice The type of interest rate model used for this token
        InterestRateModelType interestRateModelType;

        /// @notice The interest rate model contract
        IInterestRateModel interestRateModel;

        /// @notice Maximum Loan To Value (LTV) ratio to prevent liquidation
        uint216 maxLtvRatio;
    }

    // @todo byte pack all of these
    struct ReserveTokenTotals {
        // Packed slot: 32 + 128 + 96 = 256

        /// @notice The last time the debt was updated for this token
        uint32 interestAccumulatorUpdatedAt;

        /// @notice Total amount that has already been borrowed, which increases as interest accrues
        uint128 totalDebt;

        /// @notice The interest rate as of the last borrow/repay/
        int96 interestRate;

        uint256 interestAccumulator;
    }

    struct ReserveToken {
        ReserveTokenConfig config;
        ReserveTokenTotals totals;
    }

    struct UserTokenDebt {
        uint128 debt;
        uint128 interestAccumulator;
    }

    struct UserData {
        uint256 collateralPosted;
        mapping(IERC20 => UserTokenDebt) debtData;
    }

    // @todo check if all of these are actually used
    struct ReserveCache {
        // @todo rename to totalDebt?
        /// @notice The last time the debt was updated for this token
        uint32 interestAccumulatorUpdatedAt;

        /// @notice Total amount that has already been borrowed, which increases as interest accrues
        uint128 totalDebt;

        /// @notice The interest rate as of the last borrow/repay/
        int96 interestRate;

        uint128 interestAccumulator;

        uint256 price;

        /// @notice The type of interest rate model used for this token
        InterestRateModelType interestRateModelType;

        /// @notice The interest rate model contract
        IInterestRateModel interestRateModel;

        /// @notice Maximum Loan To Value (LTV) ratio to prevent liquidation
        uint216 maxLtvRatio;

        /// @notice The max allowed to be borrowed from the TRV
        /// @dev Used as the denominator in the Utilisation Ratio
        uint256 trvDebtCeiling;
    }
}
