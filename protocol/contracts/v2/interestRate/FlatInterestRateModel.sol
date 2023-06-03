// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

import { BaseInterestRateModel } from "contracts/v2/interestRate/BaseInterestRateModel.sol";

contract FlatInterestRateModel is BaseInterestRateModel {

    /**
     * @notice The base interest rate which is the y-intercept when utilization rate is 0
     */
    uint96 public interestRate;

    /**
     * @notice Construct an interest rate model
     */
    constructor(uint256 _interestRate) {
        // @todo : assert the validity of this information
        interestRate = uint96(_interestRate);
    }

    // @todo add setters

    /**
     * @notice Calculates the current interest rate based on a utilization ratio
     * @return interestRate The interest rate (scaled by PRECISION). 0.05e18 == 5%
     */
    function computeInterestRateImpl(uint256 /*utilizationRatio*/) internal override view returns (uint96) {
        return interestRate;
    }
}
