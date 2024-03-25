pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (amo/helpers/BalancerPoolHelper.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IBalancerPoolHelper } from "contracts/interfaces/amo/helpers/IBalancerPoolHelper.sol";
import { IBalancerVault } from "contracts/interfaces/external/balancer/IBalancerVault.sol";
import { IBalancerHelpers } from "contracts/interfaces/external/balancer/IBalancerHelpers.sol";
import { AMOCommon } from "contracts/amo/helpers/AMOCommon.sol";

interface IWeightPool2Tokens {
    function getNormalizedWeights() external view returns (uint256[] memory);
}

contract BalancerPoolHelper is IBalancerPoolHelper {
    using SafeERC20 for IERC20;

    IBalancerVault public immutable override balancerVault;
    IBalancerHelpers public immutable override balancerHelpers;
    IERC20 public immutable override bptToken;
    IERC20 public immutable override protocolToken;
    IERC20 public immutable override quoteToken;
    address public immutable override amo;
    
    uint256 public constant override BPS_PRECISION = 10_000;
    uint256 public constant override PRICE_PRECISION = 1e18;

    // @notice protocolToken index in balancer pool
    uint64 public immutable override protocolTokenIndexInBalancerPool;

    bytes32 public immutable override balancerPoolId;

    constructor(
      address _balancerVault,
      address _balancerHelpers,
      address _protocolToken,
      address _quoteToken,
      address _bptToken,
      address _amo,
      uint64 _protocolTokenIndexInPool,
      bytes32 _balancerPoolId
    ) {
      balancerPoolId = _balancerPoolId;
      balancerVault = IBalancerVault(_balancerVault);
      balancerHelpers = IBalancerHelpers(_balancerHelpers);
      protocolToken = IERC20(_protocolToken);
      quoteToken = IERC20(_quoteToken);
      bptToken = IERC20(_bptToken);
      amo = _amo;
      protocolTokenIndexInBalancerPool = _protocolTokenIndexInPool;
    }

    function getBalances() public override view returns (uint256[] memory balances) {
      (, balances,) = balancerVault.getPoolTokens(balancerPoolId);
    }

    function getPairBalances() public override view returns (uint256 protocolTokenBalance, uint256 quoteTokenBalance) {
      uint256[] memory balances = getBalances();
      (protocolTokenBalance, quoteTokenBalance) = (protocolTokenIndexInBalancerPool == 0) 
        ? (balances[0], balances[1]) 
        : (balances[1], balances[0]);
    }

    /// @notice Return the spot price scaled to 1e18 
    function getSpotPrice() public override view returns (uint256) {
        (uint256 protocolTokenBalance, uint256 quoteTokenBalance) = getPairBalances();
        return (PRICE_PRECISION * quoteTokenBalance) / protocolTokenBalance;
    }

    function isSpotPriceBelowTpi(uint256 treasuryPriceIndex) external override view returns (bool) {
        return getSpotPrice() < treasuryPriceIndex;
    }

    // below TPI by a given slippage percentage
    function isSpotPriceBelowTpi(uint256 slippage, uint256 treasuryPriceIndex) public override view returns (bool) {
        uint256 slippageTpi = (slippage * treasuryPriceIndex) / BPS_PRECISION;
        return getSpotPrice() < (treasuryPriceIndex - slippageTpi);
    }

    function isSpotPriceBelowTpiLowerBound(uint256 rebalancePercentageBoundLow, uint256 treasuryPriceIndex) public override view returns (bool) {
        return isSpotPriceBelowTpi(rebalancePercentageBoundLow, treasuryPriceIndex);
    }

    function isSpotPriceAboveTpiUpperBound(uint256 rebalancePercentageBoundUp, uint256 treasuryPriceIndex) public override view returns (bool) {
        return isSpotPriceAboveTpi(rebalancePercentageBoundUp, treasuryPriceIndex);
    }

    // slippage in bps
    // above TPI by a given slippage percentage
    function isSpotPriceAboveTpi(uint256 slippage, uint256 treasuryPriceIndex) public override view returns (bool) {
      uint256 slippageTpi = (slippage * treasuryPriceIndex) / BPS_PRECISION;
      return getSpotPrice() > (treasuryPriceIndex + slippageTpi);
    }

    function isSpotPriceAboveTpi(uint256 treasuryPriceIndex) external override view returns (bool) {
        return getSpotPrice() > treasuryPriceIndex;
    }

    // @notice will exit take price above TPI by a percentage
    // percentage in bps
    // tokensOut: expected min amounts out. for rebalance this is expected `ProtocolToken` tokens out
    function willExitTakePriceAboveTpiUpperBound(
        uint256 tokensOut,
        uint256 rebalancePercentageBoundUp,
        uint256 treasuryPriceIndex
    ) public override view returns (bool) {
        uint256 maxNewTpi = (BPS_PRECISION + rebalancePercentageBoundUp) * treasuryPriceIndex / BPS_PRECISION;
        (uint256 protocolTokenBalance, uint256 quoteTokenBalance) = getPairBalances();

        // a ratio of quoteToken balances vs protocolToken balances
        uint256 newProtocolTokenBalance = protocolTokenBalance - tokensOut;
        uint256 spot = (quoteTokenBalance * PRICE_PRECISION ) / newProtocolTokenBalance;
        return spot > maxNewTpi;
    }

    function willQuoteTokenJoinTakePriceAboveTpiUpperBound(
        uint256 tokensIn,
        uint256 rebalancePercentageBoundUp,
        uint256 treasuryPriceIndex
    ) public override view returns (bool) {
        uint256 maxNewTpi = (BPS_PRECISION + rebalancePercentageBoundUp) * treasuryPriceIndex / BPS_PRECISION;
        (uint256 protocolTokenBalance, uint256 quoteTokenBalance) = getPairBalances();

        uint256 newQuoteTokenBalance = quoteTokenBalance + tokensIn;
        uint256 spot = (newQuoteTokenBalance * PRICE_PRECISION ) / protocolTokenBalance;
        return spot > maxNewTpi;
    }

    function willQuoteTokenExitTakePriceBelowTpiLowerBound(
        uint256 tokensOut,
        uint256 rebalancePercentageBoundLow,
        uint256 treasuryPriceIndex
    ) public override view returns (bool) {
        uint256 minNewTpi = (BPS_PRECISION - rebalancePercentageBoundLow) * treasuryPriceIndex / BPS_PRECISION;
        (uint256 protocolTokenBalance, uint256 quoteTokenBalance) = getPairBalances();

        uint256 newQuoteTokenBalance = quoteTokenBalance - tokensOut;
        uint256 spot = (newQuoteTokenBalance * PRICE_PRECISION) / protocolTokenBalance;
        return spot < minNewTpi;
    }

    function willJoinTakePriceBelowTpiLowerBound(
        uint256 tokensIn,
        uint256 rebalancePercentageBoundLow,
        uint256 treasuryPriceIndex
    ) public override view returns (bool) {
        uint256 minNewTpi = (BPS_PRECISION - rebalancePercentageBoundLow) * treasuryPriceIndex / BPS_PRECISION;
        (uint256 protocolTokenBalance, uint256 quoteTokenBalance) = getPairBalances();

        // a ratio of quoteToken balances vs ProtocolToken balances
        uint256 newProtocolTokenBalance = protocolTokenBalance + tokensIn;
        uint256 spot = (quoteTokenBalance * PRICE_PRECISION) / newProtocolTokenBalance;
        return spot < minNewTpi;
    }

    // get the change between spot price before and spot price now
    function getSlippage(uint256 spotPriceBefore) public override view returns (uint256) {
        uint256 spotPriceNow = getSpotPrice();

        // taking into account both rebalance up or down
        uint256 priceDifference;
        unchecked {
            priceDifference = (spotPriceNow > spotPriceBefore)
                ? spotPriceNow - spotPriceBefore
                : spotPriceBefore - spotPriceNow;
        }
        return (priceDifference * BPS_PRECISION) / spotPriceBefore;
    }

    function createPoolExitRequest(
        uint256 bptAmountIn,
        uint256 minAmountOut,
        uint256 exitTokenIndex
    ) internal view returns (IBalancerVault.ExitPoolRequest memory request) {
        address[] memory assets = new address[](2);
        uint256[] memory minAmountsOut = new uint256[](2);

        (assets[0], assets[1]) = protocolTokenIndexInBalancerPool == 0 ? (address(protocolToken), address(quoteToken)) : (address(quoteToken), address(protocolToken));
        (minAmountsOut[0], minAmountsOut[1]) = exitTokenIndex == uint256(0) ? (minAmountOut, uint256(0)) : (uint256(0), minAmountOut); 
        // EXACT_BPT_IN_FOR_ONE_TOKEN_OUT index is 0 for exitKind
        bytes memory encodedUserdata = abi.encode(uint256(0), bptAmountIn, exitTokenIndex);
        request.assets = assets;
        request.minAmountsOut = minAmountsOut;
        request.userData = encodedUserdata;
        request.toInternalBalance = false;
    }

    function createPoolJoinRequest(
        uint256 amountIn,
        uint256 tokenIndex,
        uint256 minTokenOut
    ) internal view returns (IBalancerVault.JoinPoolRequest memory request) {
        address[] memory assets = new address[](2);
        uint256[] memory maxAmountsIn = new uint256[](2);
    
        (assets[0], assets[1]) = protocolTokenIndexInBalancerPool == 0 ? (address(protocolToken), address(quoteToken)) : (address(quoteToken), address(protocolToken));
        (maxAmountsIn[0], maxAmountsIn[1]) = tokenIndex == uint256(0) ? (amountIn, uint256(0)) : (uint256(0), amountIn);
        //uint256 joinKind = 1; //EXACT_TOKENS_IN_FOR_BPT_OUT
        bytes memory encodedUserdata = abi.encode(uint256(1), maxAmountsIn, minTokenOut);
        request.assets = assets;
        request.maxAmountsIn = maxAmountsIn;
        request.userData = encodedUserdata;
        request.fromInternalBalance = false;
    }

    function exitPool(
        uint256 bptAmountIn,
        uint256 minAmountOut,
        uint256 rebalancePercentageBoundLow,
        uint256 rebalancePercentageBoundUp,
        uint256 postRebalanceDelta,
        uint256 exitTokenIndex,
        uint256 treasuryPriceIndex,
        IERC20 exitPoolToken
    ) external override onlyAmo returns (uint256 amountOut) {
        exitPoolToken == protocolToken ? 
            validateProtocolTokenExit(minAmountOut, rebalancePercentageBoundUp, rebalancePercentageBoundLow, treasuryPriceIndex) :
            validateQuoteTokenExit(minAmountOut, rebalancePercentageBoundUp, rebalancePercentageBoundLow, treasuryPriceIndex);

        // create request
        IBalancerVault.ExitPoolRequest memory exitPoolRequest = createPoolExitRequest(bptAmountIn,
            minAmountOut, exitTokenIndex);

        // execute call and check for sanity
        uint256 exitTokenBalanceBefore = exitPoolToken.balanceOf(msg.sender);
        uint256 spotPriceBefore = getSpotPrice();
        balancerVault.exitPool(balancerPoolId, address(this), msg.sender, exitPoolRequest);
        uint256 exitTokenBalanceAfter = exitPoolToken.balanceOf(msg.sender);

        unchecked {
            amountOut = exitTokenBalanceAfter - exitTokenBalanceBefore;
        }

        if (getSlippage(spotPriceBefore) > postRebalanceDelta) {
            revert AMOCommon.HighSlippage();
        }
    }

    function joinPool(
        uint256 amountIn,
        uint256 minBptOut,
        uint256 rebalancePercentageBoundUp,
        uint256 rebalancePercentageBoundLow,
        uint256 treasuryPriceIndex,
        uint256 postRebalanceDelta,
        uint256 joinTokenIndex,
        IERC20 joinPoolToken
    ) external override onlyAmo returns (uint256 bptOut) {
        joinPoolToken == protocolToken ? 
            validateProtocolTokenJoin(amountIn, rebalancePercentageBoundUp, rebalancePercentageBoundLow, treasuryPriceIndex) :
            validateQuoteTokenJoin(amountIn, rebalancePercentageBoundUp, rebalancePercentageBoundLow, treasuryPriceIndex);

        // create request
        IBalancerVault.JoinPoolRequest memory joinPoolRequest = createPoolJoinRequest(amountIn, joinTokenIndex, minBptOut);

        // approve
        uint256 joinPoolTokenAllowance = joinPoolToken.allowance(address(this), address(balancerVault));
        if (joinPoolTokenAllowance < amountIn) {
            // some tokens like bb-a-USD always set the max allowance for `balancerVault`
            // in this case, `safeIncreaseAllowance` will fail due to the arithmetic operation overflow issue
            joinPoolToken.safeDecreaseAllowance(address(balancerVault), joinPoolTokenAllowance);
            joinPoolToken.safeIncreaseAllowance(address(balancerVault), amountIn);
        }

        // execute and sanity check
        uint256 bptAmountBefore = bptToken.balanceOf(msg.sender);
        uint256 spotPriceBefore = getSpotPrice();
        balancerVault.joinPool(balancerPoolId, address(this), msg.sender, joinPoolRequest);
        uint256 bptAmountAfter = bptToken.balanceOf(msg.sender);

        unchecked {
            bptOut = bptAmountAfter - bptAmountBefore;
        }

        // revert if high slippage after pool join
        if (getSlippage(spotPriceBefore) > postRebalanceDelta) {
            revert AMOCommon.HighSlippage();
        }
    }

    function validateProtocolTokenJoin(
        uint256 amountIn,
        uint256 rebalancePercentageBoundUp,
        uint256 rebalancePercentageBoundLow,
        uint256 treasuryPriceIndex
    ) internal view {
        if (!isSpotPriceAboveTpiUpperBound(rebalancePercentageBoundUp, treasuryPriceIndex)) {
            revert AMOCommon.NoRebalanceDown();
        }
        // should rarely be the case, but a sanity check nonetheless
        if (willJoinTakePriceBelowTpiLowerBound(amountIn, rebalancePercentageBoundLow, treasuryPriceIndex)) {
            revert AMOCommon.HighSlippage();
        }
    }

    function validateProtocolTokenExit(
        uint256 amountOut,
        uint256 rebalancePercentageBoundUp,
        uint256 rebalancePercentageBoundLow,
        uint256 treasuryPriceIndex
    ) internal view {
        // check spot price is below Tpi by lower bound
        if (!isSpotPriceBelowTpiLowerBound(rebalancePercentageBoundLow, treasuryPriceIndex)) {
            revert AMOCommon.NoRebalanceUp();
        }

        // will exit take price above TPI + upper bound
        // should rarely be the case, but a sanity check nonetheless
        if (willExitTakePriceAboveTpiUpperBound(amountOut, rebalancePercentageBoundUp, treasuryPriceIndex)) {
            revert AMOCommon.HighSlippage();
        }
    }

    function validateQuoteTokenJoin(
        uint256 amountIn,
        uint256 rebalancePercentageBoundUp,
        uint256 rebalancePercentageBoundLow,
        uint256 treasuryPriceIndex
    ) internal view {
        if (!isSpotPriceBelowTpiLowerBound(rebalancePercentageBoundLow, treasuryPriceIndex)) {
            revert AMOCommon.NoRebalanceUp();
        }
        // should rarely be the case, but a sanity check nonetheless
        if (willQuoteTokenJoinTakePriceAboveTpiUpperBound(amountIn, rebalancePercentageBoundUp, treasuryPriceIndex)) {
            revert AMOCommon.HighSlippage();
        }
    }

    function validateQuoteTokenExit(
        uint256 amountOut,
        uint256 rebalancePercentageBoundUp,
        uint256 rebalancePercentageBoundLow,
        uint256 treasuryPriceIndex
    ) internal view {
        if (!isSpotPriceAboveTpiUpperBound(rebalancePercentageBoundUp, treasuryPriceIndex)) {
            revert AMOCommon.NoRebalanceDown();
        }
        // should rarely be the case, but a sanity check nonetheless
        if (willQuoteTokenExitTakePriceBelowTpiLowerBound(amountOut, rebalancePercentageBoundLow, treasuryPriceIndex)) {
            revert AMOCommon.HighSlippage();
        }
    }

    /// @notice Get the quote used to add liquidity proportionally
    /// @dev Since this is not the view function, this should be called with `callStatic`
    function proportionalAddLiquidityQuote(
        uint256 quoteTokenAmount,
        uint256 slippageBps
    ) external override returns (
        uint256 protocolTokenAmount,
        uint256 expectedBptAmount,
        uint256 minBptAmount,
        IBalancerVault.JoinPoolRequest memory requestData
    ) {
        (uint256 protocolTokenBalanceInLP, uint256 quoteTokenBalanceInLP) = getPairBalances();
        // see Balancer SDK for the calculation
        // https://github.com/balancer/balancer-sdk/blob/be692be5d6057f5e44362667e47bd7ecf9a83b37/balancer-js/src/modules/pools/proportional-amounts/index.ts#L24
        protocolTokenAmount = quoteTokenBalanceInLP == 0
            ? quoteTokenAmount
            : (protocolTokenBalanceInLP * quoteTokenAmount / quoteTokenBalanceInLP);

        requestData.assets = new address[](2);
        requestData.maxAmountsIn = new uint256[](2);
        
        (requestData.assets[0], requestData.assets[1]) = protocolTokenIndexInBalancerPool == 0 ? (address(protocolToken), address(quoteToken)) : (address(quoteToken), address(protocolToken));
        (requestData.maxAmountsIn[0], requestData.maxAmountsIn[1]) = protocolTokenIndexInBalancerPool == 0 ? (protocolTokenAmount, quoteTokenAmount) : (quoteTokenAmount, protocolTokenAmount);
        //uint256 joinKind = 1; //EXACT_TOKENS_IN_FOR_BPT_OUT
        bytes memory encodedUserdata = abi.encode(uint256(1), requestData.maxAmountsIn, 0);
        requestData.userData = encodedUserdata;
        requestData.fromInternalBalance = false;

        (expectedBptAmount, ) = balancerHelpers.queryJoin(balancerPoolId, amo, amo, requestData);
        minBptAmount = applySlippage(expectedBptAmount, slippageBps);

        // update `requestData` with the `minBptAmount` to which the slippage was applied
        encodedUserdata = abi.encode(uint256(1), requestData.maxAmountsIn, minBptAmount);
        requestData.userData = encodedUserdata;
    }

    /// @notice Get the quote used to remove liquidity
    /// @dev Since this is not the view function, this should be called with `callStatic`
    function proportionalRemoveLiquidityQuote(
        uint256 bptAmount,
        uint256 slippageBps
    ) external override returns (
        uint256 expectedProtocolTokenAmount,
        uint256 expectedQuoteTokenAmount,
        uint256 minProtocolTokenAmount,
        uint256 minQuoteTokenAmount,
        IBalancerVault.ExitPoolRequest memory requestData
    ) {
        requestData.assets = new address[](2);
        requestData.minAmountsOut = new uint256[](2);

        (requestData.assets[0], requestData.assets[1]) = protocolTokenIndexInBalancerPool == 0
            ? (address(protocolToken), address(quoteToken))
            : (address(quoteToken), address(protocolToken));
        // EXACT_BPT_IN_FOR_TOKENS_OUT index is 1 for exitKind
        bytes memory encodedUserdata = abi.encode(uint256(1), bptAmount);
        requestData.userData = encodedUserdata;
        requestData.toInternalBalance = false;

        (, requestData.minAmountsOut) = balancerHelpers.queryExit(balancerPoolId, amo, amo, requestData);
        (expectedProtocolTokenAmount, expectedQuoteTokenAmount) = protocolTokenIndexInBalancerPool == 0
            ? (requestData.minAmountsOut[0], requestData.minAmountsOut[1])
            : (requestData.minAmountsOut[1], requestData.minAmountsOut[0]);
        minProtocolTokenAmount = applySlippage(expectedProtocolTokenAmount, slippageBps);
        minQuoteTokenAmount = applySlippage(expectedQuoteTokenAmount, slippageBps);

        // update `requestData` with the `minAmountsOut` to which the slippage was applied
        (requestData.minAmountsOut[0], requestData.minAmountsOut[1]) = protocolTokenIndexInBalancerPool == 0
            ? (minProtocolTokenAmount, minQuoteTokenAmount)
            : (minQuoteTokenAmount, minProtocolTokenAmount);
    }

    function applySlippage(uint256 amountIn, uint256 slippageBps) public override pure returns (uint256 amountOut) {
        amountOut = amountIn * (BPS_PRECISION - slippageBps) / BPS_PRECISION;
    }

    modifier onlyAmo() {
        if (msg.sender != amo) {
            revert AMOCommon.OnlyAMO();
        }
        _;
    }
}