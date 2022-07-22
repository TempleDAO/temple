import { SubGraphResponse } from 'hooks/core/types';
import { BigNumber } from 'ethers';

export interface SubgraphPool {
  address: string;
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
    address: string;
    balance: string;
    name: string;
    priceRate: string;
    weight: string;
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

export type Pool = Omit<SubgraphPool, 'createTime' | 'holdersCount' | 'shares' | 'swapFee' | 'tokens' | 'totalLiquidity' | 'totalSwapFee' | 'totalSwapVolume' | 'totalWeight' | 'weightUpdates'> & {
  createTime: Date;
  holdersCount: number;
  shares: {
    balance: BigNumber;
    userAddress: {
      id: string;
    };
  }[];
  swapFee: BigNumber;
  tokens: {
    symbol: string;
    address: string;
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
    endWeights: [BigNumber, BigNumber];
    startWeights: [BigNumber, BigNumber];
  }[];
}

export interface AuctionContext {
  pool?: Pool;
}

