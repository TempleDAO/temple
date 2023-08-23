pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/interestRate/IInterestRateModel.sol)

interface IInterestRateModel {
    /**
     * @notice Calculates the current interest rate based on a utilization ratio
     * @param utilizationRatio The utilization ratio scaled to `PRECISION`
     * @return interestRate The interest rate (scaled by PRECISION). 0.05e18 == 5%
     */
    function calculateInterestRate(
        uint256 utilizationRatio
    ) external view returns (uint96 interestRate);
}