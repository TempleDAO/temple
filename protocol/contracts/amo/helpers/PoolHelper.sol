pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/AMO__IBalancerVault.sol";
import "../helpers/AMOCommon.sol";


interface IWeightPool2Tokens {
    function getNormalizedWeights() external view returns (uint256[] memory);
}

contract PoolHelper is Ownable {
    AMO__IBalancerVault public immutable balancerVault;
    // @notice Temple price floor denominator
    uint256 public constant TPF_PRECISION = 10_000;

    // @notice temple index in balancer pool
    uint64 public immutable templeBalancerPoolIndex;

    // @notice percentage bounds (in bps) beyond which to rebalance up or down
    uint64 public rebalancePercentageBoundLow;
    uint64 public rebalancePercentageBoundUp;

    bytes32 public immutable balancerPoolId;

    // @notice Temple price floor ratio
    uint256 public templePriceFloorNumerator;

    event SetTemplePriceFloorNumerator(uint128);

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

    function setTemplePriceFloorNumerator(uint128 _numerator) external onlyOwner {
        templePriceFloorNumerator = _numerator;

        emit SetTemplePriceFloorNumerator(_numerator);
    }

    // @notice percentage bounds (in bps) beyond which to rebalance up or down
    function setRebalancePercentageBounds(uint64 belowTPF, uint64 aboveTPF) external onlyOwner {
        if (belowTPF >= TPF_PRECISION || aboveTPF >= TPF_PRECISION) {
            revert AMOCommon.InvalidBPSValue(belowTPF);
        }
        rebalancePercentageBoundLow = belowTPF;
        rebalancePercentageBoundUp = aboveTPF;
    }

    function getTempleStableBalances() public view returns (uint256 templeBalance, uint256 stableBalance) {
      uint256[] memory balances = getBalances();
      (templeBalance, stableBalance) = (templeBalancerPoolIndex == 0) 
        ? (balances[0], balances[1]) 
        : (balances[1], balances[0]);
    }

    function getSpotPriceScaled() public view returns (uint256 spotPriceScaled) {
        (uint256 templeBalance, uint256 stableBalance) = getTempleStableBalances();
        spotPriceScaled = (TPF_PRECISION * stableBalance) / templeBalance;
    }

    function isSpotPriceBelowTPF() external view returns (bool) {
        return getSpotPriceScaled() < templePriceFloorNumerator;
    }

    // below TPF by a given slippage percentage
    function isSpotPriceBelowTPF(uint256 slippage) public view returns (bool) {
        uint256 slippageTPF = (slippage * templePriceFloorNumerator) / TPF_PRECISION;
        return getSpotPriceScaled() < (templePriceFloorNumerator - slippageTPF);
    }

    function isSpotPriceBelowTPFLowerBound() external view returns (bool) {
        return isSpotPriceBelowTPF(rebalancePercentageBoundLow);
    }

    function isSpotPriceAboveTPFUpperBound() external view returns (bool) {
        return isSpotPriceAboveTPF(rebalancePercentageBoundUp);
    }

    // slippage in bps
    // above TPF by a given slippage percentage
    function isSpotPriceAboveTPF(uint256 slippage) public view returns (bool) {
      uint256 slippageTPF = (slippage * templePriceFloorNumerator) / TPF_PRECISION;
      return getSpotPriceScaled() > (templePriceFloorNumerator + slippageTPF);
    }

     function isSpotPriceAboveTPF() external view returns (bool) {
        return getSpotPriceScaled() > templePriceFloorNumerator;
    }

    // @notice will exit take price above tpf by a percentage
    // percentage in bps
    // tokensOut: expected min amounts out. for rebalance this is expected Temple tokens out
    function willExitTakePriceAboveTPFUpperBound(uint256 tokensOut) external view returns (bool) {
        uint256 percentageIncrease = (templePriceFloorNumerator * rebalancePercentageBoundUp) / TPF_PRECISION;
        uint256 maxNewTpf = percentageIncrease + templePriceFloorNumerator;
        (, uint256[] memory balances,) = balancerVault.getPoolTokens(balancerPoolId);
        uint256 stableIndexInPool = templeBalancerPoolIndex == 0 ? 1 : 0;
        // a ratio of stable balances with quote price and fees
        uint256 newTempleBalance = balances[templeBalancerPoolIndex] - tokensOut;
        uint256 quote = (balances[stableIndexInPool] * TPF_PRECISION ) / newTempleBalance;
        return quote > maxNewTpf;
    }

    function willJoinTakePriceBelowTPFLowerBound(uint256 tokensIn) external view returns (bool) {
        uint256 percentageDecrease = (templePriceFloorNumerator * rebalancePercentageBoundLow) / TPF_PRECISION;
        uint256 minNewTpf = templePriceFloorNumerator - percentageDecrease;
        (, uint256[] memory balances,) = balancerVault.getPoolTokens(balancerPoolId);
        uint256 stableIndexInPool = templeBalancerPoolIndex == 0 ? 1 : 0;
        // a ratio of temple balances with quote price and fees
        uint256 newTempleBalance = balances[templeBalancerPoolIndex] + tokensIn;
        uint256 spot = (balances[stableIndexInPool] * TPF_PRECISION) / newTempleBalance;
        return spot < minNewTpf;
    }

    // get slippage between spot price before and spot price now
    function getSlippage(uint256 spotPriceBeforeScaled) external view returns (uint256) {
        uint256 spotPriceNowScaled = getSpotPriceScaled();
        // taking into account both rebalance up or down
        uint256 slippageDifference;
        unchecked {
            slippageDifference = (spotPriceNowScaled > spotPriceBeforeScaled)
                ? spotPriceNowScaled - spotPriceBeforeScaled
                : spotPriceBeforeScaled - spotPriceNowScaled;
        }
        return (slippageDifference * TPF_PRECISION) / spotPriceBeforeScaled;
    }

    function getMax(uint256 a, uint256 b) external pure returns (uint256) {
        // if (a < b) {
        //     maxValue = b;
        // } else {
        //     maxValue = a;
        // }
        assembly {
            mstore(0, a)
            if lt(a, b) { mstore(0, b) }
            return (0, 0x20)
        }
    }

    function createPoolExitRequest(
        address temple,
        address stable,
        uint256 bptAmountIn,
        uint256 tokenIndex,
        uint256 minAmountOut,
        uint256 exitTokenIndex
    ) external view returns (AMO__IBalancerVault.ExitPoolRequest memory request) {
        address[] memory assets = new address[](2);
        uint256[] memory minAmountsOut = new uint256[](2);
        if (templeBalancerPoolIndex == 0) {
            assets[0] = temple;
            assets[1] = stable;
            minAmountsOut[0] = tokenIndex == 0 ? minAmountOut: 0;
            minAmountsOut[1] = tokenIndex == 0 ? 0: minAmountOut;
        } else {
            assets[0] = stable;
            assets[1] = temple;
            minAmountsOut[0] = tokenIndex == 1 ? 0 : minAmountOut;
            minAmountsOut[1] = tokenIndex == 1 ? minAmountOut: 0;
        }
        // EXACT_BPT_IN_FOR_ONE_TOKEN_OUT index is 0 for exitKind
        bytes memory encodedUserdata = abi.encode(uint256(0), bptAmountIn, exitTokenIndex);
        request.assets = assets;
        request.minAmountsOut = minAmountsOut;
        request.userData = encodedUserdata;
        request.toInternalBalance = false;
    }

    function createPoolJoinRequest(
        IERC20 temple,
        IERC20 stable,
        uint256 amountIn,
        uint256 tokenIndex,
        uint256 minTokenOut
    ) external view returns (AMO__IBalancerVault.JoinPoolRequest memory request) {
        IERC20[] memory assets = new IERC20[](2);
        uint256[] memory maxAmountsIn = new uint256[](2);
        if (templeBalancerPoolIndex == 0) {
            assets[0] = temple;
            assets[1] = stable;
            maxAmountsIn[0] = tokenIndex == 0 ? amountIn: 0;
            maxAmountsIn[1] = tokenIndex == 0 ? 0 : amountIn;
        } else {
            assets[0] = stable;
            assets[1] = temple;
            maxAmountsIn[0] = tokenIndex == 1 ? 0 : amountIn;
            maxAmountsIn[1] = tokenIndex == 1 ? amountIn : 0;
        }
        //uint256 joinKind = 1; //EXACT_TOKENS_IN_FOR_BPT_OUT
        bytes memory encodedUserdata = abi.encode(uint256(1), maxAmountsIn, minTokenOut);
        request.assets = assets;
        request.maxAmountsIn = maxAmountsIn;
        request.userData = encodedUserdata;
        request.fromInternalBalance = false;
    }
}