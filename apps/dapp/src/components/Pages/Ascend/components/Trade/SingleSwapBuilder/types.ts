import { BigNumber, BigNumberish } from 'ethers';

export enum SwapType {
  SwapExactIn,
  SwapExactOut,
}

export interface SwapV2 {
  poolId: string;
  assetInIndex: number;
  assetOutIndex: number;
  amount: string;
  userData: string;
}

export interface SwapInfo {
  tokenAddresses: string[];
  swaps: SwapV2[];
  swapAmount: BigNumber;
  swapAmountForSwaps: BigNumber; // Used with stETH/wstETH
  returnAmount: BigNumber;
  returnAmountFromSwaps: BigNumber; // Used with stETH/wstETH
  returnAmountConsideringFees: BigNumber;
  tokenIn: string;
  tokenInForSwaps?: string; // Used with stETH/wstETH
  tokenOut: string;
  tokenOutFromSwaps?: string; // Used with stETH/wstETH
  marketSp: string;
}

export enum Relayers {
  vault = 1,
  lido = 2,
}

export interface SwapRelayer {
  id: Relayers;
  address: string;
}

export interface FundManagement {
  sender: string;
  recipient: string;
  fromInternalBalance: boolean;
  toInternalBalance: boolean;
};

export type SingleSwap = {
  poolId: string;
  kind: SwapType;
  assetIn: string;
  assetOut: string;
  amount: BigNumberish;
  userData: string;
};

export type Swap = {
  request: SingleSwap;
  funds: FundManagement;
  limit: BigNumberish;
  deadline: BigNumberish;
  value?: BigNumberish;
  outputReference?: BigNumberish;
};
