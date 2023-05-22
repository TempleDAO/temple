pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/templeLineOfCredit/TlcReserveLogic.sol)

import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { CompoundedInterest } from "contracts/v2/interestRate/CompoundedInterest.sol";
import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";
import { SafeCast } from "contracts/common/SafeCast.sol";

// import "forge-std/console.sol";

// @todo revisit just making this an abstract base contract.
library TlcReserveLogic { 
    using CompoundedInterest for uint256;
    using SafeCast for uint256;

    event InterestRateUpdate(address indexed token, int96 newInterestRate);
    int96 internal constant MAX_ALLOWED_INTEREST_RATE = 5e18; // 500%
    int96 internal constant MIN_ALLOWED_INTEREST_RATE = 0;

    function initCache(
        ITlcDataTypes.ReserveToken storage reserveToken,
        ITreasuryReservesVault treasuryReservesVault,
        ITlcDataTypes.ReserveCache memory reserveCache
    ) internal view returns (bool dirty) {
        reserveCache.interestRateModel = reserveToken.config.interestRateModel;
        reserveCache.interestRateModelType = reserveToken.config.interestRateModelType;
        reserveCache.maxLtvRatio = reserveToken.config.maxLtvRatio;
        reserveCache.interestAccumulator = reserveToken.totals.interestAccumulator.encodeUInt128();
        reserveCache.totalDebt = reserveToken.totals.totalDebt;
        reserveCache.interestRate = reserveToken.totals.interestRate;

        reserveCache.interestAccumulatorUpdatedAt = reserveToken.totals.interestAccumulatorUpdatedAt;

        // @todo These aren't stored in storage.
        {
            if (reserveCache.interestRateModelType == ITlcDataTypes.InterestRateModelType.TRV_UTILIZATION_RATE) {
                reserveCache.trvDebtCeiling = treasuryReservesVault.strategyDebtCeiling(address(this));
            }

            reserveCache.price = (reserveToken.config.tokenPriceType == ITlcDataTypes.TokenPriceType.STABLE)
                ? treasuryReservesVault.treasuryPriceIndex()
                : 10_000;
        }

        uint32 blockTs = uint32(block.timestamp);
        if (blockTs != reserveCache.interestAccumulatorUpdatedAt) {
            dirty = true;

            // @todo Euler also checks for overflows and ignores if it will take it over...?
            // {
            //     console.log("updating accumulator:");
            //     console.log("\twas:", reserveCache.interestAccumulator);
            //     console.log("\tdelta:", block.timestamp - reserveCache.interestAccumulatorUpdatedAt);
            //     console.log("\trate:", uint256(int256(reserveCache.interestRate)));
            //     console.log("\tanswer:", reserveCache.interestAccumulator.continuouslyCompounded(
            //         block.timestamp - reserveCache.interestAccumulatorUpdatedAt,
            //         reserveCache.interestRate
            //     ));
            // }
            // @todo change CC to int96, and test it works
            uint256 newInterestAccumulator = uint256(reserveCache.interestAccumulator).continuouslyCompounded(
                blockTs - reserveCache.interestAccumulatorUpdatedAt,
                reserveCache.interestRate
            );
            // @todo need a muldiv?
            reserveCache.totalDebt = (newInterestAccumulator * reserveCache.totalDebt  / reserveCache.interestAccumulator).encodeUInt128();
            reserveCache.interestAccumulator = newInterestAccumulator.encodeUInt128();
            reserveCache.interestAccumulatorUpdatedAt = blockTs;
        }  
    }

    function cache(
        ITlcDataTypes.ReserveToken storage reserveToken,
        ITreasuryReservesVault treasuryReservesVault
    ) internal returns (
        ITlcDataTypes.ReserveCache memory reserveCache
    ) {
        if (initCache(reserveToken, treasuryReservesVault, reserveCache)) {
            reserveToken.totals.interestAccumulatorUpdatedAt = reserveCache.interestAccumulatorUpdatedAt;
            reserveToken.totals.totalDebt = reserveCache.totalDebt;
            reserveToken.totals.interestAccumulator = reserveCache.interestAccumulator;
        }
    }

    // @todo read only re-entrancy?
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

    function utilizationRatio(
        ITlcDataTypes.ReserveCache memory reserveCache
    ) internal pure returns (uint256 ur) {
        if (reserveCache.interestRateModelType == ITlcDataTypes.InterestRateModelType.TRV_UTILIZATION_RATE) {
            ur = uint256(reserveCache.totalDebt) * 1e18 / reserveCache.trvDebtCeiling;
        } 
    }

    function updateInterestRates(
        ITlcDataTypes.ReserveCache memory reserveCache, 
        ITlcDataTypes.ReserveToken storage reserveToken, 
        address reserveAddress
    ) internal {
        int96 newInterestRate = reserveCache.interestRateModel.calculateInterestRate(
            utilizationRatio(reserveCache)
        );

        // console.log("updateInterestRates:", reserveAddress, uint256(int256(reserveCache.interestRate)), uint256(int256(newInterestRate)));
        if (reserveCache.interestRate != newInterestRate) {
            emit InterestRateUpdate(reserveAddress, newInterestRate);
            reserveToken.totals.interestRate = newInterestRate;
        }
    }
}