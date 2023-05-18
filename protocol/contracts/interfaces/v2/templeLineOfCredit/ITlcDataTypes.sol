pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol)

import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";

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
        uint256 maxLtvRatio;
    }

    // @todo byte pack all of these
    struct ReserveTokenTotals {
        /// @notice Total amount that has already been borrowed, which increases as interest accrues
        uint256 debt;

        //// @notice Total number of shares that have been issued
        uint256 shares;

        /// @notice The interest rate as of the last borrow/repay/
        uint256 interestRate;

        /// @notice The last time the debt was updated for this token
        uint256 lastUpdatedAt;
    }

    struct ReserveToken {
        ReserveTokenConfig config;
        ReserveTokenTotals totals;
    }

    // @todo check if all of these are actually used
    struct ReserveCache {
        /// @notice Total amount that has already been borrowed, which increases as interest accrues
        uint256 debt;

        //// @notice Total number of shares that have been issued
        uint256 shares;

        /// @notice The interest rate as of the last borrow/repay/
        uint256 interestRate;

        /// @notice The last time the debt was updated for this token
        uint256 lastUpdatedAt;

        /// @notice The type of interest rate model used for this token
        InterestRateModelType interestRateModelType;

        /// @notice The interest rate model contract
        IInterestRateModel interestRateModel;

        /// @notice The max allowed to be borrowed from the TRV
        /// @dev Used as the denominator in the Utilisation Ratio
        uint256 trvDebtCeiling;
        // ITreasuryReservesVault treasuryReservesVault;

        /// @notice The type of how to lookup the price of the token
        TokenPriceType tokenPriceType;

        /// @notice Maximum Loan To Value (LTV) ratio to prevent liquidation
        uint256 maxLtvRatio;
    }
}
