# Zaps Documentation

## Temple Zaps

This section covers temple-specific zaps including core and liquidity pool zaps.


### Generating data for swap

Particularly for temple/core zaps, the starting token has to be zapped into one of the stable tokens that our private AMM supports before interacting with the private AMM router. The quickest way to get the necessary swap data is by using exchange API. `0x` API is being used here.

Example `GET` request url for real-time swap data to exchange 500000000000000000000 `ETH` to `FRAX`:

`https://api.0x.org/swap/v1/quote?sellToken=0x0000000000000000000000000000000000000000&sellAmount=500000000000000000000&buyToken=0x853d955acef822db058eb8505911ed77f175b99e`

The `data` property of the response object is what is used as `_swapData` in most  `TempleZaps` functions.

### Zapping ETH or ERC20 token to TEMPLE

The functions of importance here are `TempleZaps.zapInTemple()` and `TempleZaps.zapInTempleFor()`. See functions for details on function parameters.


```solidity
function zapInTemple(
  address _fromToken,
  uint256 _fromAmount,
  uint256 _minTempleReceived,
  address _stableToken,
  uint256 _minStableReceived,
  address _swapTarget,
  bytes memory _swapData
) external payable;

function zapInTempleFor(
  address _fromToken,
  uint256 _fromAmount,
  uint256 _minTempleReceived,
  address _stableToken,
  uint256 _minStableReceived,
  address _recipient,
  address _swapTarget,
  bytes memory _swapData
) public payable;
```

### Zapping ETH or ERC20 token to Temple LP

To add LP to any of the pools [TEMPLE/FRAX]() and [TEMPLE/FEI](), use any of `TempleZaps.zapInTempleLPFor()` or `TempleZaps.zapInTempleLP()`. 
Parameter worth mentioning here is `TempleLiquidityParams` with the following properties.

```solidity
struct TempleLiquidityParams {
  uint256 amountAMin;
  uint256 amountBMin;
  uint256 lpSwapMinAmountOut;
  address stableToken;
  bool transferResidual;
}

```
To prevent frontrunning, it's highly recommended to compute these values offchain and use these amounts as safestops for the values that are computed onchain.

`amountAMin, amountBMin`: These values ensure the minimum of the desired amounts of tokens that you wish to add to the LP are met. You can compute them by calling the helper view function `TempleZaps.addLiquidityGetMinAmounts()`.

`lpSwapMinAmountOut`: Minimum amount of tokens out when exchanging one token for another in the same pool that one wishes to add liquidity. This is the case where a two-sided liquidity addition is being done. By default, univ2 pools require 2-sided liquidity addition (i.e. 2 tokens). This could be a uniV2 pool, curve pool or balancer pool.

`transferResidual`: in the case of univ2 LPs, there may be very small amounts of either tokens left over after liquidity has been finally added. This flag is set to `true` if LP recipient wants these small amounts back.

### Zapping ETH or ERC20 token into core vault

`TempleZaps.zapInVaultFor()` and `TempleZaps.zapInVault()` are the relevant functions. Similar to zapping into temple except exit temple is staked into core vault.

## Generic Zaps

Generic zaps zap to tokens that are not temple/core-specific. Some underlying features are used by temple zaps.

### Params

```solidity
struct ZapLiquidityRequest {
  uint248 firstSwapMinAmountOut;
  bool useAltFunction;
  uint248 poolSwapMinAmountOut;
  bool isOneSidedLiquidityAddition;
  address otherToken;
  bool shouldTransferResidual;
  uint256 minLiquidityOut;
  uint256 uniAmountAMin;
  uint256 uniAmountBMin;
  bytes poolSwapData;
}
```
`firstSwapMinAmountOut`: Minimum amount out for DEX swap.

`useAltFunction`: This flag is for special case base 2 curve pools such as fxs/cvxFxs pool, where `addLiquidity()` function requires 4 arguments (an extra bool flag for eth deposit) as opposed to the usual 3 arguments (amounts, minimum liquidity out and recipient address`).

`poolSwapMinAmountOut`: Minimum amount out when exchanging one token for the other in the same pool liquidity is supposed to be added (if not one-sided liquidity addition).

`isOneSidedLiquidityAddition`: 

`otherToken`: Second token in pool to swap to, before liquidity addition (if not one-sided liquidity addition).

`shouldTransferResidual`: If residual tokens remaining should be transferred

`minLiquidityOut`: Minimum amount of liquidity tokens to receive

`uniAmountAMin, uniAmountBMin`: These values ensure the minimum of the desired amounts of tokens that you wish to add to the LP are met. You can compute them by calling the helper view function `GenericZaps.addLiquidityGetMinAmounts()`. Applicable to UniV2.

`poolSwapData`: Swap data for exchanging one token for the other, before adding liquidity to pool. Particular to curve and balancer pools.



### Zapping ETH or ERC20 token to another token

Similar to `zapInTemple()`, `GenericZaps.zapIn()` and `GenericZaps.zapInFor()` swap from one token to the other (except exit token could be any ERC20 token).

### Zapping ETH or ERC20 token to UniV2 LP

Similar to temple zaps process. Functions of interest are `zapLiquidityUniV2For()` and `zapLiquidityUniV2()`.

### Zapping ETH or ERC20 token to Curve LP

Similar to temple zaps process. Functions of interest are `zapLiquidityCurvePoolFor()` and `zapLiquidityCurvePool()`

### Zapping ETH or ERC20 token to Balancer LP

Functions of interest are `zapLiquidityBalancerPoolFor()` and `zapLiquidityBalancerPool()`.