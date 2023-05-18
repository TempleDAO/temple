pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/templeLineOfCredit/TlcReserveLogic.sol)

import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { CompoundedInterest } from "contracts/v2/interestRate/CompoundedInterest.sol";
import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";

import "forge-std/console.sol";

library TlcReserveLogic { 
    using CompoundedInterest for uint256;

    event InterestRateUpdate(address indexed token, uint256 newInterestRate);

    function cache(
        ITlcDataTypes.ReserveToken storage reserveToken,
        ITreasuryReservesVault treasuryReservesVault
    ) internal view returns (
        ITlcDataTypes.ReserveCache memory reserveCache
    ) {
        // reserveCache.collateral = reserveToken.totals.collateral;
        reserveCache.debt = reserveToken.totals.debt;
        reserveCache.shares = reserveToken.totals.shares;
        reserveCache.interestRate = reserveToken.totals.interestRate;
        reserveCache.lastUpdatedAt = reserveToken.totals.lastUpdatedAt;

        reserveCache.interestRateModel = reserveToken.config.interestRateModel;
        reserveCache.interestRateModelType = reserveToken.config.interestRateModelType;
        reserveCache.tokenPriceType = reserveToken.config.tokenPriceType;
        reserveCache.maxLtvRatio = reserveToken.config.maxLtvRatio;

        if (reserveCache.interestRateModelType == ITlcDataTypes.InterestRateModelType.TRV_UTILIZATION_RATE) {
            reserveCache.trvDebtCeiling = treasuryReservesVault.strategyDebtCeiling(address(this));
        }
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

    function updateState(
        ITlcDataTypes.ReserveCache memory reserveCache,
        ITlcDataTypes.ReserveToken storage reserveToken
    ) internal {
        if (reserveCache.lastUpdatedAt == block.timestamp) {
            return;
        }

        reserveToken.totals.debt = reserveCache.debt = compoundDebt(reserveCache);
        reserveToken.totals.lastUpdatedAt = reserveCache.lastUpdatedAt = block.timestamp;
    }

    function utilizationRatio(
        ITlcDataTypes.ReserveCache memory reserveCache
    ) internal pure returns (uint256 ur) {
        if (reserveCache.interestRateModelType == ITlcDataTypes.InterestRateModelType.TRV_UTILIZATION_RATE) {
            ur = reserveCache.debt * 1e18 / reserveCache.trvDebtCeiling;
        } 
    }

    function getBorrowRate(
        ITlcDataTypes.ReserveCache memory reserveCache, 
        uint256 amountAddedToDebt,
        uint256 amountRemovedFromDebt
    ) internal view returns (uint256) {
        if (reserveCache.interestRateModelType == ITlcDataTypes.InterestRateModelType.TRV_UTILIZATION_RATE) {
            console.log("getBorrowRate TRV:");
            console.log("\tdebt params:", reserveCache.debt, amountAddedToDebt, amountRemovedFromDebt);
            console.log("\tnumerator:", reserveCache.debt + amountAddedToDebt - amountRemovedFromDebt);
            console.log("\tdenominator:", reserveCache.trvDebtCeiling);
            console.log("\tanswer:", reserveCache.interestRateModel.getBorrowRate(
                reserveCache.debt + amountAddedToDebt - amountRemovedFromDebt, 
                reserveCache.trvDebtCeiling
            ));
            return reserveCache.interestRateModel.getBorrowRate(
                reserveCache.debt + amountAddedToDebt - amountRemovedFromDebt, 
                reserveCache.trvDebtCeiling
            );
        } else {
            return reserveCache.interestRateModel.getBorrowRate(0, 0);
        }
    }

    function updateInterestRates(
        ITlcDataTypes.ReserveCache memory reserveCache, 
        ITlcDataTypes.ReserveToken storage reserveToken, 
        address reserveAddress,
        uint256 amountAddedToDebt,
        uint256 amountRemovedFromDebt
    ) internal {
        uint256 newInterestRate = getBorrowRate(reserveCache, amountAddedToDebt, amountRemovedFromDebt);
        console.log("updateInterestRates:", reserveAddress, reserveCache.interestRate, newInterestRate);
        if (reserveCache.interestRate != newInterestRate) {
            emit InterestRateUpdate(reserveAddress, newInterestRate);
            reserveToken.totals.interestRate = newInterestRate;
        }
    }
}