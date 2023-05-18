// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

// import "forge-std/console.sol";

import {IInterestRateModel} from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";

// @todo consider making this a lib instead to save gas.
// depends if we are likely to change it.

import "forge-std/console.sol";

contract LinearInterestRateModel is IInterestRateModel {
    
    uint256 private constant PRECISION = 1e18;

    /**
     * @notice The base interest rate which is the y-intercept when utilization rate is 0
     */
    uint256 public baseInterestRate;

    /**
     * @notice Interest rate at 100 percent utilization
     */
    uint256 public maxInterestRate;

    /**
     * @notice The utilization point at which slope changes
     */
    uint256 public kinkUtilization;

    /**
     * @notice Interest rate at kink
     */
    uint256 public kinkInterestRate;

    /**
     * @notice Construct an interest rate model
     * @param _baseInterestRate base interest rate which is the y-intercept when utilization rate is 0
     * @param _maxInterestRate Interest rate at 100 percent utilization
     * @param _kinkUtilization The utilization point at which slope changes
     * @param _kinkInterestRate Interest rate at the `kinkUtiliszation`;
     */
    constructor(
        uint256 _baseInterestRate, 
        uint256 _maxInterestRate, 
        uint256 _kinkUtilization, 
        uint256 _kinkInterestRate
    ) {
        // @todo : assert the validity of this information
        baseInterestRate = _baseInterestRate;
        maxInterestRate  = _maxInterestRate;
        kinkUtilization = _kinkUtilization;
        kinkInterestRate = _kinkInterestRate;
    }

    // @todo add setters

    struct BorrowRateVars {
        uint256 actualUtilizationRatio;
        uint256 baseRate;
        uint256 rateAtKink;
        uint256 maxRate;
        uint256 kinkUtilizationRatio;
    }

    /**
     * @notice Calculates the current borrow rate per block
     * @param totalBorrow total borrowed
     * @param totalAvailable total reserve available for borrowing
     * @return The borrow rate (scaled by PRECISION)
     */
    function getBorrowRate(uint256 totalBorrow, uint256 totalAvailable) public view returns (uint256) {
        console.log("getBorrowRate:", totalBorrow, totalAvailable);

        // If totalAvailable == 0, then just return the minimum rate
        if (totalAvailable == 0) {
            return baseInterestRate;
        }
        console.log("getBorrowRate1:");

        BorrowRateVars memory vars = BorrowRateVars({
            actualUtilizationRatio: (totalBorrow * PRECISION) /  totalAvailable, 
            baseRate: baseInterestRate,
            rateAtKink: kinkInterestRate,
            maxRate: maxInterestRate,
            kinkUtilizationRatio: kinkUtilization
        });
        
        // utilizationRate(totalBorrow, totalAvailable);
        console.log("\t\tgetBorrowRate: UR:", vars.actualUtilizationRatio, "kink at:", vars.kinkUtilizationRatio);

        if (vars.actualUtilizationRatio <= vars.kinkUtilizationRatio) {
            // Slope between base% -> kink%
            uint256 slope = ((vars.rateAtKink - vars.baseRate) * PRECISION ) / vars.kinkUtilizationRatio;
            console.log("\t<=KINK:", vars.baseRate, slope, vars.baseRate + ((vars.actualUtilizationRatio * slope) / PRECISION));
            return vars.baseRate + ((vars.actualUtilizationRatio * slope) / PRECISION);
        } else {
            // Slope between kink% -> max%
            uint256 slope = (((vars.maxRate - vars.rateAtKink ) * PRECISION) / ( PRECISION  - vars.kinkUtilizationRatio));
            console.log("\t>KINK:", vars.rateAtKink, vars.rateAtKink + (((vars.actualUtilizationRatio - vars.kinkUtilizationRatio) * slope) / PRECISION));
            return vars.rateAtKink + (((vars.actualUtilizationRatio - vars.kinkUtilizationRatio) * slope) / PRECISION);
        }
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