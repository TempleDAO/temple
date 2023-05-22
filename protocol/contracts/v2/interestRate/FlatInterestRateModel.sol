// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

// import "forge-std/console.sol";

import { BaseInterestRateModel } from "contracts/v2/interestRate/BaseInterestRateModel.sol";

// @todo consider making this a lib instead to save gas.
// depends if we are likely to change it.

// import "forge-std/console.sol";

contract FlatInterestRateModel is BaseInterestRateModel {

    /**
     * @notice The base interest rate which is the y-intercept when utilization rate is 0
     */
    int96 public interestRate;

    /**
     * @notice Construct an interest rate model
     */
    constructor(uint256 _interestRate) {
        // @todo : assert the validity of this information
        interestRate = int96(int256(_interestRate));
    }

    // @todo add setters

    /**
     * @notice Calculates the current interest rate based on a utilization ratio
     * @return interestRate The interest rate (scaled by PRECISION). 0.05e18 == 5%
     */
    function computeInterestRateImpl(uint256 /*utilizationRatio*/) internal override view returns (int96) {
        return interestRate;
    }
}
