pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/AMO__IBalancerVault.sol";


interface IWeightPool2Tokens {
    function getNormalizedWeights() external view returns (uint256[] memory);
}

contract PoolHelper is Ownable {
    AMO__IBalancerVault public immutable balancerVault;
    // @notice Temple price floor denominator
    uint256 public constant TPF_PRECISION = 10_000;

    uint64 public immutable templeBalancerPoolIndex;
    bytes32 public immutable balancerPoolId;

    // @notice Temple price floor ratio
    TreasuryPriceFloor public templePriceFloorRatio;

    struct TreasuryPriceFloor {
        uint128 numerator;
        uint128 denominator;
    }

    event SetTemplePriceFloorRatio(uint128, uint128);

    constructor(
      address _balancerVault,
      address _temple,
      bytes32 _balancerPoolId
    ) {
      (address[] memory tokens,,) = AMO__IBalancerVault(_balancerVault).getPoolTokens(_balancerPoolId);
      uint256 index;
      for (uint i=0; i<tokens.length; i++) {
          if (tokens[i] == address(_temple)) {
              index = i;
              break;
          }
      }
      templeBalancerPoolIndex = uint64(index);
      balancerPoolId = _balancerPoolId;
      balancerVault = AMO__IBalancerVault(_balancerVault);
    }

    function getBalances() public view returns (uint256[] memory balances) {
      (, balances,) = balancerVault.getPoolTokens(balancerPoolId);
    }

    function setTemplePriceFloorRatio(uint128 _numerator) external onlyOwner {
        templePriceFloorRatio.numerator = _numerator;
        templePriceFloorRatio.denominator = uint128(TPF_PRECISION);

        emit SetTemplePriceFloorRatio(_numerator, uint128(TPF_PRECISION));
    }

    function spotPriceUsingLPRatio() public view returns (uint256 templeBalance, uint256 stableBalance) {
      uint256[] memory balances = getBalances();
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

    function getSpotPriceScaled() public view returns (uint256 spotPriceScaled) {
      (uint256 templeBalance, uint256 stableBalance) = spotPriceUsingLPRatio();
      spotPriceScaled = (TPF_PRECISION * stableBalance) / templeBalance;
    }

    function isSpotPriceBelowTPF() external view returns (bool) {
      uint256 spotPriceScaled = getSpotPriceScaled();
      if (spotPriceScaled < templePriceFloorRatio.numerator) {
          return true;
      }
      return false;
    }

    // below TPF by a given slippage percentage
    function isSpotPriceBelowTPF(uint256 slippage) external view returns (bool) {
      uint256 spotPriceScaled = getSpotPriceScaled();
      uint256 slippageTPF =  (slippage * templePriceFloorRatio.numerator) / templePriceFloorRatio.denominator;
      if (spotPriceScaled < templePriceFloorRatio.numerator - slippageTPF) {
          return true;
      }
      return false;
    }

    // slippage in bps
    // above TPF by a given slippage percentage
    function isSpotPriceAboveTPF(uint256 slippage) external view returns (bool) {
      uint256 spotPriceScaled = getSpotPriceScaled();
      uint256 slippageTPF = (slippage * templePriceFloorRatio.numerator) / templePriceFloorRatio.denominator;
      if (spotPriceScaled > templePriceFloorRatio.numerator + slippageTPF) {
          return true;
      }
      return false;
    }

     function isSpotPriceAboveTPF() external view returns (bool) {
        uint256 spotPriceScaled = getSpotPriceScaled();
        if (spotPriceScaled > templePriceFloorRatio.numerator) {
            return true;
        }
        return false;
    }

    function _getMax(uint256 a, uint256 b) external pure returns (uint256 maxValue) {
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