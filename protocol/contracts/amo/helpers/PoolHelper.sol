pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later


import "../interfaces/IBalancerVault.sol";

interface IWeightPool2Tokens {
    function getNormalizedWeights() external view returns (uint256[] memory);
}

abstract contract PoolHelper {

    // @notice balancer 50/50 pool ID.
    bytes32 public balancerPoolId;

    // @notice temple index in balancer pool. to avoid recalculation or external calls
    uint64 public templeBalancerPoolIndex;

    // @notice Temple price floor denominator
    uint256 public constant TPF_PRECISION = 10_000;

    // @notice Temple price floor ratio
    TreasuryPriceFloor public templePriceFloorRatio;

    struct TreasuryPriceFloor {
        uint128 numerator;
        uint128 denominator;
    }

    function spotPriceUsingLPRatio(uint256[] memory balances) internal view returns (uint256 templeBalance, uint256 stableBalance) {
        if (templeBalancerPoolIndex == 0) {
            //price = balances[0] / balances[1];
            templeBalance = balances[0];
            stableBalance = balances[1];
        } else {
            //price = balances[1] / balances[0];
            templeBalance = balances[1];
            stableBalance = balances[0];
        }
    }

    function getSpotPriceScaled(uint256[] memory balances) internal view returns (uint256 spotPriceScaled) {
        (uint256 templeBalance, uint256 stableBalance) = spotPriceUsingLPRatio(balances);
        spotPriceScaled = (TPF_PRECISION * stableBalance) / templeBalance;
    }

    function isSpotPriceBelowTPF(uint256[] memory balances) internal view returns (bool) {
        uint256 spotPriceScaled = getSpotPriceScaled(balances);
        if (spotPriceScaled < templePriceFloorRatio.numerator) {
            return true;
        }
        return false;
    }

    // below TPF by a given slippage percentage
    function isSpotPriceBelowTPF(uint256[] memory balances, uint256 slippage) internal view returns (bool) {
        uint256 spotPriceScaled = getSpotPriceScaled(balances);
        uint256 slippageTPF =  (slippage * templePriceFloorRatio.numerator) / templePriceFloorRatio.denominator;
        if (spotPriceScaled < templePriceFloorRatio.numerator - slippageTPF) {
            return true;
        }
        return false;
    }

    function isSpotPriceAboveTPF(uint256[] memory balances) internal view returns (bool) {
        uint256 spotPriceScaled = getSpotPriceScaled(balances);
        if (spotPriceScaled > templePriceFloorRatio.numerator) {
            return true;
        }
        return false;
    }

    // slippage in bps
    // above TPF by a given slippage percentage
    function isSpotPriceAboveTPF(uint256[] memory balances, uint256 slippage) internal view returns (bool) {
        uint256 spotPriceScaled = getSpotPriceScaled(balances);
        uint256 slippageTPF = (slippage * templePriceFloorRatio.numerator) / templePriceFloorRatio.denominator;
        if (spotPriceScaled > templePriceFloorRatio.numerator + slippageTPF) {
            return true;
        }
        return false;
    }

    function _getMax(uint256 a, uint256 b) internal pure returns (uint256 maxValue) {
        // if (a < b) {
        //     maxValue = b;
        // } else {
        //     maxValue = a;
        // }
        assembly {
            if lt(a, b) { maxValue := b }
            if iszero(maxValue) { maxValue := a }
        }
    }
}