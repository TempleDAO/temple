// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";

abstract contract BaseInterestRateModel is IInterestRateModel {
    
    uint256 internal constant PRECISION = 1e18;

    int96 internal constant MAX_ALLOWED_INTEREST_RATE = 5e18; // 500% APR
    int96 internal constant MIN_ALLOWED_INTEREST_RATE = 0;

    function computeInterestRateImpl(uint256) internal virtual view returns (int96);

    /**
     * @notice Calculates the current interest rate based on a utilization ratio
     * @dev The rates are bound to sensible min/max amounts, but it does not fail.
     * @return interestRate The interest rate (scaled by PRECISION). 0.05e18 == 5%
     */
    function calculateInterestRate(uint256 utilizationRatio) public view returns (int96 interestRate) {
        interestRate = computeInterestRateImpl(utilizationRatio);

        if (interestRate > MAX_ALLOWED_INTEREST_RATE) {
            interestRate = MAX_ALLOWED_INTEREST_RATE;
        } else if (interestRate < MIN_ALLOWED_INTEREST_RATE) {
            interestRate = MIN_ALLOWED_INTEREST_RATE;
        }
    }
}