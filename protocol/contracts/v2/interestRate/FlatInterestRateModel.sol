// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

import { BaseInterestRateModel } from "contracts/v2/interestRate/BaseInterestRateModel.sol";
import { SafeCast } from "contracts/common/SafeCast.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";

contract FlatInterestRateModel is BaseInterestRateModel, TempleElevatedAccess {

    event InterestRateSet(uint256 rate);

    /**
     * @notice The base interest rate which is the y-intercept when utilization rate is 0
     */
    uint96 public interestRate;

    /**
     * @notice Construct an interest rate model
     */
    constructor(address _initialRescuer, address _initialExecutor, uint256 _interestRate) 
        TempleElevatedAccess(_initialRescuer, _initialExecutor)
    {
        interestRate = SafeCast.encodeUInt96(_interestRate);
    }

    function setInterestRate(uint256 _interestRate) external onlyElevatedAccess {
        interestRate = SafeCast.encodeUInt96(_interestRate);
        emit InterestRateSet(interestRate);
    }

    /**
     * @notice Calculates the current interest rate based on a utilization ratio
     * @return interestRate The interest rate (scaled by PRECISION). 0.05e18 == 5%
     */
    function computeInterestRateImpl(uint256 /*utilizationRatio*/) internal override view returns (uint96) {
        return interestRate;
    }
}
