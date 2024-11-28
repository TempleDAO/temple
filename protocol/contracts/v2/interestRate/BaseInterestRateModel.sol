pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/interestRate/BaseInterestRateModel.sol)

import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";

/**
 * @notice An abstract base contract to calculate the interest rate derived from the current utilization ratio (UR) of debt.
 */
abstract contract BaseInterestRateModel is IInterestRateModel {
    
    uint256 internal constant PRECISION = 1e18;

    uint96 internal constant MAX_ALLOWED_INTEREST_RATE = 5e18; // 500% APR

    /**
     * @notice Derived interest rate model contracts need to implement.
     */
    function computeInterestRateImpl(uint256) internal virtual view returns (uint96);

    /**
     * @notice Calculates the current interest rate based on a utilization ratio
     * @dev The rates are bound to sensible min/max amounts, but it does not fail.
     * @return interestRate The interest rate (scaled by PRECISION). 0.05e18 == 5%
     */
    function calculateInterestRate(uint256 utilizationRatio) external view returns (uint96 interestRate) {
        // Cap the UR at 100%
        if (utilizationRatio > PRECISION) {
            utilizationRatio = PRECISION;
        }

        interestRate = computeInterestRateImpl(utilizationRatio);

        if (interestRate > MAX_ALLOWED_INTEREST_RATE) {
            interestRate = MAX_ALLOWED_INTEREST_RATE;
        }
    }
}
