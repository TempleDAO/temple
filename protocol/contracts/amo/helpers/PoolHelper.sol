pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later


//import "../interfaces/IBalancerVault.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface AMO__IBalancerVault {

  struct JoinPoolRequest {
    IERC20[] assets;
    uint256[] maxAmountsIn;
    bytes userData;
    bool fromInternalBalance;
  }

  struct ExitPoolRequest {
    address[] assets;
    uint256[] minAmountsOut;
    bytes userData;
    bool toInternalBalance;
  }

  struct BatchSwapStep {
    bytes32 poolId;
    uint256 assetInIndex;
    uint256 assetOutIndex;
    uint256 amount;
    bytes userData;
  }

  struct FundManagement {
    address sender;
    bool fromInternalBalance;
    address payable recipient;
    bool toInternalBalance;
  }

  enum JoinKind { 
    INIT, 
    EXACT_TOKENS_IN_FOR_BPT_OUT, 
    TOKEN_IN_FOR_EXACT_BPT_OUT, 
    ALL_TOKENS_IN_FOR_EXACT_BPT_OUT 
  }

  enum SwapKind {
    GIVEN_IN,
    GIVEN_OUT
  }

  function batchSwap(
    SwapKind kind,
    BatchSwapStep[] memory swaps,
    address[] memory assets,
    FundManagement memory funds,
    int256[] memory limits,
    uint256 deadline
  ) external returns (int256[] memory assetDeltas);

  function joinPool(
    bytes32 poolId,
    address sender,
    address recipient,
    JoinPoolRequest memory request
  ) external payable;

  function exitPool( 
    bytes32 poolId, 
    address sender, 
    address recipient, 
    ExitPoolRequest memory request 
  ) external;

  function getPoolTokens(
    bytes32 poolId
  ) external view
    returns (
      address[] memory tokens,
      uint256[] memory balances,
      uint256 lastChangeBlock
  );
}

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