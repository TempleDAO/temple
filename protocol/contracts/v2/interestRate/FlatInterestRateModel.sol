// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

// import "forge-std/console.sol";

import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";

// @todo consider making this a lib instead to save gas.
// depends if we are likely to change it.

// import "forge-std/console.sol";

contract FlatInterestRateModel is IInterestRateModel {
    
    uint256 private constant PRECISION = 1e18;

    /**
     * @notice The base interest rate which is the y-intercept when utilization rate is 0
     */
    uint256 public interestRate;

    /**
     * @notice Construct an interest rate model
     */
    constructor(uint256 _interestRate) {
        // @todo : assert the validity of this information
        interestRate = _interestRate;
    }

    // @todo add setters

    /**
     * @notice Calculates the current interest rate based on a utilization ratio
     * @return interestRate The interest rate (scaled by PRECISION). 0.05e18 == 5%
     */
    function calculateInterestRate(uint256 /*utilizationRatio*/) public view returns (uint256) {
        return interestRate;
    }
}
