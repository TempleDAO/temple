// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

// import "forge-std/console.sol";

import { BaseInterestRateModel } from "contracts/v2/interestRate/BaseInterestRateModel.sol";
import { SafeCast } from "contracts/common/SafeCast.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";

contract LinearWithKinkInterestRateModel is BaseInterestRateModel, TempleElevatedAccess {
    using SafeCast for uint256;

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

    RateParams public rateParams;

    event InterestRateParamsSet(
        uint256 _baseInterestRate, 
        uint256 _maxInterestRate, 
        uint256 _kinkUtilizationRatio, 
        uint256 _kinkInterestRate
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
        uint256 _baseInterestRate, 
        uint256 _maxInterestRate, 
        uint256 _kinkUtilizationRatio, 
        uint256 _kinkInterestRate
    ) TempleElevatedAccess(_initialRescuer, _initialExecutor)
    {
        rateParams = RateParams({
            baseInterestRate: _baseInterestRate.encodeUInt80(),
            maxInterestRate: _maxInterestRate.encodeUInt80(),
            kinkInterestRate: _kinkInterestRate.encodeUInt80(),
            kinkUtilizationRatio: _kinkUtilizationRatio
        });
    }
    
    function setRateParams(
        uint256 _baseInterestRate, 
        uint256 _maxInterestRate, 
        uint256 _kinkUtilizationRatio, 
        uint256 _kinkInterestRate
    ) external onlyElevatedAccess {
        rateParams = RateParams({
            baseInterestRate: _baseInterestRate.encodeUInt80(),
            maxInterestRate: _maxInterestRate.encodeUInt80(),
            kinkInterestRate: _kinkInterestRate.encodeUInt80(),
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

        // console.log("linear compute:", utilizationRatio);
        uint256 interestRate;
        if (utilizationRatio <= _rateParams.kinkUtilizationRatio) {
            // Slope between base% -> kink%
            uint256 slope = (
                (PRECISION * (_rateParams.kinkInterestRate - _rateParams.baseInterestRate))
                 / _rateParams.kinkUtilizationRatio
            );
            interestRate = (
                (utilizationRatio * slope / PRECISION) 
                + _rateParams.baseInterestRate
            );
        } else {
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
        }

        return uint96(interestRate);
    }
}


/**
Can graph the borrow curve at:
https://www.mathworks.com/help/matlab/ref/plot.html


kinkUtilization = 90;
baseRate = 5;
kinkRate = 10;
maxRate = 20;

x1 = linspace(0, kinkUtilization);
slope1 = (kinkRate - baseRate) * 100 / kinkUtilization;
y1 = baseRate + (slope1 * x1 / 100);

x2 = linspace(kinkUtilization, 100);
slope2 = (maxRate - kinkRate) * 100 / (100 - kinkUtilization);
y2 = kinkRate + (slope2 * (x2-kinkUtilization) / 100);

figure
plot(x1,y1,"-x",x2,y2,"-x","MarkerIndices",1:10:100)

title('Borrow Rate Curve')
xlabel('Utilization Ratio')
ylabel('Interest Rate')
*/