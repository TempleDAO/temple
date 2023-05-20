pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/templeLineOfCredit/TlcReserveLogic.sol)

import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { CompoundedInterest } from "contracts/v2/interestRate/CompoundedInterest.sol";
import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";

import "forge-std/console.sol";

// @todo revisit just making this an abstract base contract.
library TlcReserveLogic { 
    using CompoundedInterest for uint256;

    event InterestRateUpdate(address indexed token, uint256 newInterestRate);

    function initCache(
        ITlcDataTypes.ReserveToken storage reserveToken,
        ITreasuryReservesVault treasuryReservesVault,
        ITlcDataTypes.ReserveCache memory reserveCache
    ) internal view returns (bool dirty) {
        reserveCache.interestRateModel = reserveToken.config.interestRateModel;
        reserveCache.interestRateModelType = reserveToken.config.interestRateModelType;
        // reserveCache.tokenPriceType = reserveToken.config.tokenPriceType;
        reserveCache.maxLtvRatio = reserveToken.config.maxLtvRatio;

        reserveCache.interestAccumulator = reserveToken.totals.interestAccumulator;

        // reserveCache.collateral = reserveToken.totals.collateral;
        reserveCache.debt = reserveToken.totals.debt;
        reserveCache.interestRate = reserveToken.totals.interestRate;

        // @todo rename to interestAccumulatorUpdatedAt
        reserveCache.lastUpdatedAt = reserveToken.totals.lastUpdatedAt;
        // reserveCache.trvDebtCeiling = reserveToken.totals.maxBorrowLimit;

        // @todo These aren't stored in storage.
        {
            if (reserveCache.interestRateModelType == ITlcDataTypes.InterestRateModelType.TRV_UTILIZATION_RATE) {
                reserveCache.trvDebtCeiling = treasuryReservesVault.strategyDebtCeiling(address(this));
            }

            reserveCache.price = (reserveToken.config.tokenPriceType == ITlcDataTypes.TokenPriceType.STABLE)
                ? treasuryReservesVault.treasuryPriceIndex()
                : 10_000;
        }

        if (block.timestamp != reserveCache.lastUpdatedAt) {
            dirty = true;

            // @todo Euler also checks for overflows and ignores if it will take it over...?
            {
                console.log("updating accumulator:");
                console.log("\twas:", reserveCache.interestAccumulator);
                console.log("\tdelta:", block.timestamp - reserveCache.lastUpdatedAt);
                console.log("\trate:", reserveCache.interestRate);
                console.log("\tanswer:", reserveCache.interestAccumulator.continuouslyCompounded(
                    block.timestamp - reserveCache.lastUpdatedAt,
                    reserveCache.interestRate
                ));
            }

            uint256 newInterestAccumulator = reserveCache.interestAccumulator.continuouslyCompounded(
                block.timestamp - reserveCache.lastUpdatedAt,
                reserveCache.interestRate
            );
            // @todo need a muldiv?
            reserveCache.debt = reserveCache.debt * newInterestAccumulator / reserveCache.interestAccumulator;
            reserveCache.interestAccumulator = newInterestAccumulator;


            // if (reserveCache.tokenPriceType == TokenPriceType.STABLE) {
            //     reserveCache.price = treasuryReservesVault.treasuryPriceIndex();
            // }
            
            reserveCache.lastUpdatedAt = block.timestamp;
        }  
    }

    function cache(
        ITlcDataTypes.ReserveToken storage reserveToken,
        ITreasuryReservesVault treasuryReservesVault
    ) internal returns (
        ITlcDataTypes.ReserveCache memory reserveCache
    ) {
        if (initCache(reserveToken, treasuryReservesVault, reserveCache)) {
            reserveToken.totals.lastUpdatedAt = reserveCache.lastUpdatedAt;
            reserveToken.totals.debt = reserveCache.debt;
            reserveToken.totals.interestAccumulator = reserveCache.interestAccumulator;
        }
    }

    function cacheRO(
        ITlcDataTypes.ReserveToken storage reserveToken,
        ITreasuryReservesVault treasuryReservesVault
    ) internal view returns (
        ITlcDataTypes.ReserveCache memory reserveCache
    ) {
        initCache(reserveToken, treasuryReservesVault, reserveCache);
    }

    // @todo when the TRV cap changes, the UR will change. A checkpoint will need to be done then too, 
    // so the rate is updated.
    // add a test for this.

    function compoundDebt(ITlcDataTypes.ReserveCache memory reserveCache) internal view returns (uint256 updatedDebt) {
        console.log("compoundDebt():", reserveCache.debt);
        console.log("\tat rate:", reserveCache.interestRate);
        console.log("\tfor secs:", block.timestamp - reserveCache.lastUpdatedAt);

        updatedDebt = reserveCache.debt.continuouslyCompounded(
            block.timestamp - reserveCache.lastUpdatedAt, 
            reserveCache.interestRate
        );
    }

    function utilizationRatio(
        ITlcDataTypes.ReserveCache memory reserveCache
    ) internal pure returns (uint256 ur) {
        if (reserveCache.interestRateModelType == ITlcDataTypes.InterestRateModelType.TRV_UTILIZATION_RATE) {
            ur = reserveCache.debt * 1e18 / reserveCache.trvDebtCeiling;
        } 
    }

    function getBorrowRate(
        ITlcDataTypes.ReserveCache memory reserveCache
    ) internal view returns (uint256) {
        return reserveCache.interestRateModel.calculateInterestRate(
                utilizationRatio(reserveCache)
        );
        // // uint256 utilizationRatio: (reserveCache.debt * 1e18) /  totalAvailable, 

        // // @todo do the UR here and pass it through instead.

        // if (reserveCache.interestRateModelType == ITlcDataTypes.InterestRateModelType.TRV_UTILIZATION_RATE) {
        //     console.log("getBorrowRate TRV:");
        //     console.log("\tdebt params:", reserveCache.debt); //, amountAddedToDebt, amountRemovedFromDebt);
        //     console.log("\tnumerator:", reserveCache.debt); // + amountAddedToDebt - amountRemovedFromDebt);
        //     console.log("\tdenominator:", reserveCache.trvDebtCeiling);
        //     console.log("\tanswer:", reserveCache.interestRateModel.getBorrowRate(
        //         utilizationRatio(reserveCache)
        //         // reserveCache.debt, // + amountAddedToDebt - amountRemovedFromDebt, 
        //         // reserveCache.trvDebtCeiling
        //     ));
        //     return reserveCache.interestRateModel.getBorrowRate(
        //         utilizationRatio(reserveCache)
        //         // reserveCache.debt, // + amountAddedToDebt - amountRemovedFromDebt, 
        //         // reserveCache.trvDebtCeiling
        //     );
        // } else {
        //     // @todo I still don't like this. Perhaps just defer to another
        //     return reserveCache.interestRateModel.getBorrowRate(0, 0);
        // }
    }

    function updateInterestRates(
        ITlcDataTypes.ReserveCache memory reserveCache, 
        ITlcDataTypes.ReserveToken storage reserveToken, 
        address reserveAddress
        // uint256 amountAddedToDebt,
        // uint256 amountRemovedFromDebt
    ) internal {
        uint256 newInterestRate = getBorrowRate(reserveCache); //, amountAddedToDebt, amountRemovedFromDebt);
        console.log("updateInterestRates:", reserveAddress, reserveCache.interestRate, newInterestRate);
        if (reserveCache.interestRate != newInterestRate) {
            emit InterestRateUpdate(reserveAddress, newInterestRate);
            reserveToken.totals.interestRate = newInterestRate;
        }
    }
}