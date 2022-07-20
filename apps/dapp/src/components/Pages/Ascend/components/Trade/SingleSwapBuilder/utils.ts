import { constants } from 'ethers';
import { Interface, JsonFragment } from '@ethersproject/abi'
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { SwapInfo, SwapType, FundManagement, SingleSwap, Swap } from './types';

/**
 * Maps SOR data to get the tokenIn used in swaps.
 * Logic related to a relayer wrapping and unwrapping tokens.
 * SOR returns list of already wrapped tokenAddresses used in the swap.
 * However tokenIn defined as an input is the unwrapped token.
 * Note: tokenAddresses are transformed in SOR lib wrapInfo.setWrappedInfo
 * TODO: Once PR is merged, this table can be removed.
 */
 type WrappedList = {
  [key: string]: string;
};

const underlyingToWrappedMap: WrappedList = {
  // stETH => wstETH
  '0xae7ab96520de3a18e5e111b5eaab095312d7fe84':
    '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',

  // AMPL => WAMPL
  '0xd46ba6d942050d489dbd938a2c909a5d5039a161':
    '0xedb171c18ce90b633db442f2a6f72874093b49ef',

  // aAMPL -> ubAAMPL
  '0x1e6bb68acec8fefbd87d192be09bb274170a0548':
    '0xF03387d8d0FF326ab586A58E0ab4121d106147DF',
};

/**
 * Vault swaps are operating on wrapped tokens. When user is sending an unwrapped token, it's wrapped in a relayer.
 * SOR is returning an array of tokens already wrapped.
 * Converts tokenIn to match tokenIn used in a swap.
 *
 * TODO: add tokenIn and tokenOut addressed used for swap in the SOR results as tokenInForSwap, tokenOutForSwap
 *
 * @param token token address
 * @returns wrapped token address
 */
function tokenForSwaps(token: string): string {
  let wrapped = token;
  // eslint-disable-next-line no-prototype-builtins
  if (underlyingToWrappedMap.hasOwnProperty(token)) {
    wrapped = underlyingToWrappedMap[token as keyof WrappedList];
  }
  return wrapped;
}

export enum Relayers {
  vault = 1,
  lido = 2,
}

export interface SwapRelayer {
  id: Relayers;
  address: string;
}

interface AmountForLimit {
  amount: BigNumber;
  max: (slippage: number) => BigNumber;
  min: (slippage: number) => BigNumber;
}

interface SDKSwapInfo extends SwapInfo {
  /** Name mapping to improve readability. */
  amountIn: BigNumber;
  amountOut: BigNumber;
  /** Name mapping for amounts used specifically for limits calculations. */
  amountInForLimits: AmountForLimit;
  amountOutForLimits: AmountForLimit;
  /** Wrapped token addresses used in the swap. */
  tokenInForSwaps: string;
  tokenOutFromSwaps: string;
}

/** Applies slippage to a number */
function amountForLimit(amount: BigNumber): AmountForLimit {
  return {
    amount,
    max: (maxSlippage: number): BigNumber => {
      return amount.mul(1e3 + maxSlippage).div(1e3);
    },
    min: (maxSlippage: number): BigNumber => {
      return amount.mul(1e3 - maxSlippage).div(1e3);
    },
  };
}

export function decorateSorSwapInfo(
  swapInfo: SwapInfo,
  swapType: SwapType
): SDKSwapInfo {
  const amountIn =
    swapType === SwapType.SwapExactIn
      ? swapInfo.swapAmount
      : swapInfo.returnAmount;
  const amountOut =
    swapType === SwapType.SwapExactIn
      ? swapInfo.returnAmount
      : swapInfo.swapAmount;
  const amountInForLimits =
    swapType === SwapType.SwapExactIn
      ? swapInfo.swapAmountForSwaps || swapInfo.swapAmount
      : swapInfo.returnAmountFromSwaps || swapInfo.returnAmount;
  const amountOutForLimits =
    swapType === SwapType.SwapExactIn
      ? swapInfo.returnAmountFromSwaps || swapInfo.returnAmount
      : swapInfo.swapAmountForSwaps || swapInfo.swapAmount;
  const tokenInForSwaps = tokenForSwaps(swapInfo.tokenIn);
  const tokenOutFromSwaps = tokenForSwaps(swapInfo.tokenOut);

  return {
    ...swapInfo,
    amountIn,
    amountOut,
    amountInForLimits: amountForLimit(amountInForLimits),
    amountOutForLimits: amountForLimit(amountOutForLimits),
    tokenInForSwaps,
    tokenOutFromSwaps,
  };
}