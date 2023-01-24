import { SubGraphResponse } from 'hooks/core/types';
import { BigNumber } from 'ethers';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';

export interface SubgraphPool {
  address: `0x${string}`;
  symbol: string;
  createTime: number;
  holdersCount: string;
  id: string;
  name: string;
  owner: string;
  shares: {
    balance: string;
    userAddress: {
      id: string;
    };
  }[];
  strategyType: number;
  swapEnabled: boolean;
  swapFee: string;
  swaps: {
    timeStamp: number;
  }[];
  swapsCount: string;
  tokens: {
    symbol: string;
    address: `0x${string}`;
    balance: string;
    name: string;
    priceRate: string;
    weight: string;
    decimals: number;
  }[];
  tokensList: string[];
  totalLiquidity: string;
  totalSwapFee: string;
  totalSwapVolume: string;
  totalWeight: string;
  tx: string;
  vaultID: string;
  weightUpdates: {
    startTimestamp: string;
    startWeights: string[];
    endTimestamp: string;
    endWeights: string[];
  }[];
}

export type GraphResponse = SubGraphResponse<{ pools: SubgraphPool[] }>;

type OverWritteFields =
  | 'createTime'
  | 'symbol'
  | 'holdersCount'
  | 'shares'
  | 'swapFee'
  | 'tokens'
  | 'totalLiquidity'
  | 'totalSwapFee'
  | 'totalSwapVolume'
  | 'totalWeight'
  | 'weightUpdates'
  | 'symbol';

export type Pool = Omit<SubgraphPool, OverWritteFields> & {
  createTime: Date;
  holdersCount: number;
  symbol: string;
  shares: {
    balance: BigNumber;
    userAddress: {
      id: string;
    };
  }[];
  swapFee: BigNumber;
  tokens: {
    symbol: string;
    address: `0x${string}`;
    balance: BigNumber;
    name: string;
    priceRate: string;
    weight: BigNumber;
    decimals: number;
  }[];
  totalLiquidity: BigNumber;
  totalSwapFee: BigNumber;
  totalSwapVolume: BigNumber;
  totalWeight: BigNumber;
  weightUpdates: {
    endTimestamp: Date;
    startTimestamp: Date;
    endWeights: [DecimalBigNumber, DecimalBigNumber];
    startWeights: [DecimalBigNumber, DecimalBigNumber];
  }[];
};

export interface AuctionContext {
  pool?: Pool;
}
