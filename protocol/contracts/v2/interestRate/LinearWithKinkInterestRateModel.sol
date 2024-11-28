pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/interestRate/LinearWithKinkInterestRateModel.sol)

import { BaseInterestRateModel } from "contracts/v2/interestRate/BaseInterestRateModel.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

/**
 * @title 'Linear With Kink' Interest Rate Model
 * @notice An interest rate curve derived from the current utilization ratio (UR) of debt.
 * This is represented as two seperate linear slopes, joined at a 'kink' - a particular UR.
 */
contract LinearWithKinkInterestRateModel is BaseInterestRateModel, TempleElevatedAccess {
    struct RateParams {
        /// @notice The base interest rate which is the y-intercept when utilization rate is 0
        uint80 baseInterestRate;

        /// @notice Interest rate at 100 percent utilization
        uint80 maxInterestRate;

        /// @notice Interest rate at kink
        uint80 kinkInterestRate;

        /// @notice The utilization ratio point at which slope changes
        uint256 kinkUtilizationRatio;
    }

    /**
     * @notice The interest rate parameters to derive the two curves with a kink.
     */
    RateParams public rateParams;

    event InterestRateParamsSet(
        uint80 _baseInterestRate, 
        uint80 _maxInterestRate, 
        uint256 _kinkUtilizationRatio, 
        uint80 _kinkInterestRate
    );

    /**
     * @notice Construct an interest rate model
     * @param _baseInterestRate base interest rate which is the y-intercept when utilization rate is 0
     * @param _maxInterestRate Interest rate at 100 percent utilization
     * @param _kinkUtilizationRatio The utilization point at which slope changes
     * @param _kinkInterestRate Interest rate at the `kinkUtiliszation`;
     */
    constructor(
        address _initialRescuer, 
        address _initialExecutor,
        uint80 _baseInterestRate, 
        uint80 _maxInterestRate, 
        uint256 _kinkUtilizationRatio, 
        uint80 _kinkInterestRate
    ) TempleElevatedAccess(_initialRescuer, _initialExecutor)
    {
        _setRateParams(
            _baseInterestRate, 
            _maxInterestRate, 
            _kinkUtilizationRatio, 
            _kinkInterestRate
        );
    }
    
    /**
     * @notice Update the interest rate parameters.
     */
    function setRateParams(
        uint80 _baseInterestRate, 
        uint80 _maxInterestRate, 
        uint256 _kinkUtilizationRatio, 
        uint80 _kinkInterestRate
    ) external onlyElevatedAccess {
        _setRateParams(
            _baseInterestRate, 
            _maxInterestRate, 
            _kinkUtilizationRatio, 
            _kinkInterestRate
        );
    }

    function _setRateParams(
        uint80 _baseInterestRate, 
        uint80 _maxInterestRate, 
        uint256 _kinkUtilizationRatio, 
        uint80 _kinkInterestRate
    ) internal {
        if (_kinkUtilizationRatio == 0) revert CommonEventsAndErrors.InvalidParam();
        if (_kinkUtilizationRatio >= PRECISION) revert CommonEventsAndErrors.InvalidParam();
        if (_baseInterestRate > _kinkInterestRate) revert CommonEventsAndErrors.InvalidParam();
        if (_kinkInterestRate > _maxInterestRate) revert CommonEventsAndErrors.InvalidParam();

        rateParams = RateParams({
            baseInterestRate: _baseInterestRate,
            maxInterestRate: _maxInterestRate,
            kinkInterestRate: _kinkInterestRate,
            kinkUtilizationRatio: _kinkUtilizationRatio
        });
        emit InterestRateParamsSet(
            _baseInterestRate, 
            _maxInterestRate, 
            _kinkUtilizationRatio, 
            _kinkInterestRate
        );
    }

    /**
     * @notice Calculates the current interest rate based on a utilization ratio
     * @param utilizationRatio The utilization ratio scaled to `PRECISION`
     */
    function computeInterestRateImpl(uint256 utilizationRatio) internal override view returns (uint96) {
        RateParams memory _rateParams = rateParams;

        uint256 interestRate;
        // slither-disable-start divide-before-multiply
        if (utilizationRatio > _rateParams.kinkUtilizationRatio) {
            // Slope between kink% -> max%
            uint256 slope = (
                (PRECISION * (_rateParams.maxInterestRate - _rateParams.kinkInterestRate))
                / (PRECISION - _rateParams.kinkUtilizationRatio)
            );
            interestRate = (
                (
                    (slope * (utilizationRatio - _rateParams.kinkUtilizationRatio)) 
                    / PRECISION
                ) + _rateParams.kinkInterestRate
            );
        } else {
            // Slope between base% -> kink%
            uint256 slope = (
                (PRECISION * (_rateParams.kinkInterestRate - _rateParams.baseInterestRate))
                 / _rateParams.kinkUtilizationRatio
            );
            interestRate = (
                (utilizationRatio * slope / PRECISION) 
                + _rateParams.baseInterestRate
            );
        }
        // slither-disable-end divide-before-multiply
        return uint96(interestRate);
    }
}
