pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/templeLineOfCredit/TlcReserveLogic.sol)

import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { CompoundedInterest } from "contracts/v2/interestRate/CompoundedInterest.sol";
import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";
import { SafeCast } from "contracts/common/SafeCast.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { mulDiv } from "@prb/math/src/Common.sol";

import "forge-std/console.sol";

// @todo revisit just making this an abstract base contract.
library TlcBaseLogic { 
    using CompoundedInterest for uint256;
    using SafeCast for uint256;

    event InterestRateUpdate(address indexed token, int96 newInterestRate);

    uint256 public constant PRICE_PRECISION = 1e18;
    uint256 public constant LTV_PRECISION = 1e18;
    uint256 internal constant INITIAL_INTEREST_ACCUMULATOR = 1e27;

    function initCache(
        ITlcDataTypes.ReserveToken storage reserveToken,
        ITlcDataTypes.ReserveCache memory reserveCache
    ) private view returns (bool dirty) {
        reserveCache.config = reserveToken.config;

        reserveCache.interestAccumulator = reserveToken.totals.interestAccumulator.encodeUInt128();
        reserveCache.totalDebt = reserveToken.totals.totalDebt;
        reserveCache.interestRate = reserveToken.totals.interestRate;
        reserveCache.interestAccumulatorUpdatedAt = reserveToken.totals.interestAccumulatorUpdatedAt;

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
        ITlcDataTypes.ReserveToken storage reserveToken
    ) internal returns (
        ITlcDataTypes.ReserveCache memory reserveCache
    ) {
        if (initCache(reserveToken, reserveCache)) {
            reserveToken.totals.interestAccumulatorUpdatedAt = reserveCache.interestAccumulatorUpdatedAt;
            reserveToken.totals.totalDebt = reserveCache.totalDebt;
            reserveToken.totals.interestAccumulator = reserveCache.interestAccumulator;
        }
    }

    // @todo read only re-entrancy?
    function cacheRO(
        ITlcDataTypes.ReserveToken storage reserveToken
    ) internal view returns (
        ITlcDataTypes.ReserveCache memory reserveCache
    ) {
        initCache(reserveToken, reserveCache);
    }

    function updateInterestRates(
        ITlcDataTypes.ReserveToken storage reserveToken,
        ITlcDataTypes.ReserveCache memory reserveCache,
        ITreasuryReservesVault trv
    ) internal {
        int96 newInterestRate = reserveCache.config.interestRateModel.calculateInterestRate(
            utilizationRatio(reserveCache, trv)
        );

        console.log("update interest rates:");
        console.logInt(reserveCache.interestRate);
        console.logInt(newInterestRate);
        if (reserveCache.interestRate != newInterestRate) {
            emit InterestRateUpdate(reserveCache.config.tokenAddress, newInterestRate);
            reserveToken.totals.interestRate = newInterestRate;
        }
    }

    function addReserveToken(
        ITlcDataTypes.ReserveToken storage reserveToken,
        ITlcDataTypes.ReserveTokenConfig memory config
    ) internal {
        // Do not allow an LTV > 100%
        if (config.maxLtvRatio > LTV_PRECISION) revert CommonEventsAndErrors.InvalidParam();
        if (address(config.tokenAddress) == address(0)) revert CommonEventsAndErrors.ExpectedNonZero();
        if (address(config.interestRateModel) == address(0)) revert CommonEventsAndErrors.ExpectedNonZero();

        reserveToken.config = config;
        reserveToken.totals.interestAccumulator = INITIAL_INTEREST_ACCUMULATOR;
        reserveToken.totals.interestAccumulatorUpdatedAt = uint32(block.timestamp);
    }

    // @todo when the TRV cap changes, the UR will change. A checkpoint will need to be done then too, 
    // so the rate is updated.
    // add a test for this.

    function utilizationRatio(
        ITlcDataTypes.ReserveCache memory reserveCache,
        ITreasuryReservesVault trv
    ) internal view returns (uint256 ur) {
        // The UR parameter is used by the 'Fixed' interest rate model
        // console.log("utilizationRatio:");
        if (reserveCache.config.interestRateModelType == ITlcDataTypes.InterestRateModelType.TRV_UTILIZATION_RATE) {
            // console.log("utilizationRatio:", uint256(reserveCache.totalDebt), trv.strategyDebtCeiling(address(this)));
            ur = uint256(reserveCache.totalDebt) * 1e18 / trv.strategyDebtCeiling(address(this));
        } 
        // console.log("utilizationRatio result:", ur);
    }

    function currentUserTokenDebt(
        ITlcDataTypes.ReserveCache memory _reserveCache,
        uint128 _userTokenDebt,
        uint128 _userTokenInterestAccumulator
    ) internal pure returns (uint256) {
        uint256 prevDebt = _userTokenDebt;
        return (prevDebt == 0) 
            ? 0
            : prevDebt * _reserveCache.interestAccumulator / _userTokenInterestAccumulator;
    }

    function getPrice(
        ITlcDataTypes.ReserveCache memory reserveCache,
        ITreasuryReservesVault trv
    ) internal view returns (uint256) {
        // return PRICE_PRECISION;
        return (reserveCache.config.tokenPriceType == ITlcDataTypes.TokenPriceType.STABLE)
            ? trv.treasuryPriceIndex()
            : PRICE_PRECISION;
    }

    function maxBorrowCapacity(
        ITlcDataTypes.ReserveCache memory reserveCache,
        uint256 collateralPosted,
        ITreasuryReservesVault trv
    ) internal view returns (uint256) {
        return mulDiv(
            collateralPosted /* * reserveCache.price,*/ * getPrice(reserveCache, trv),
            reserveCache.config.maxLtvRatio,
            1e36
        );
    }

    function healthFactor(
        ITlcDataTypes.ReserveCache memory reserveCache,
        uint256 collateralPosted,
        uint256 debt,
        ITreasuryReservesVault trv
    ) internal view returns (uint256) {
        if (debt == 0) return type(uint256).max;

        return mulDiv(
            collateralPosted /* * reserveCache.price,*/  *  getPrice(reserveCache, trv),
            reserveCache.config.maxLtvRatio,
            debt * 1e18
        );
    }

    function loanToValueRatio(
        ITlcDataTypes.ReserveCache memory reserveCache,
        uint256 collateralPosted,
        uint256 debt,
        ITreasuryReservesVault trv
    ) internal view returns (uint256) {
        if (collateralPosted == 0) return type(uint256).max;

        return mulDiv(
            debt,
            1e36,
            collateralPosted /* * reserveCache.price,*/  *  getPrice(reserveCache, trv)
        );
    }
}