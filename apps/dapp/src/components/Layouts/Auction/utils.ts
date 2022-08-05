import { getBigNumberFromString } from 'components/Vault/utils';
import { SubgraphPool, Pool } from './types';

export const createPool = (pool: SubgraphPool): Pool => {
  return {
    ...pool,
    createTime: new Date(pool.createTime * 1000),
    holdersCount: Number(pool.holdersCount),
    shares: pool.shares.map((share) => ({
      ...share,
      balance: getBigNumberFromString(share.balance),
    })),
    swapFee: getBigNumberFromString(pool.swapFee),
    tokens: pool.tokens.map((token) => ({
      ...token,
      balance: getBigNumberFromString(token.balance),
      weight: getBigNumberFromString(token.weight),
    })), 
    totalLiquidity: getBigNumberFromString(pool.totalLiquidity),
    totalSwapFee: getBigNumberFromString(pool.totalSwapFee),
    totalSwapVolume: getBigNumberFromString(pool.totalSwapVolume),
    totalWeight: getBigNumberFromString(pool.totalWeight),
    weightUpdates: pool.weightUpdates.map((weightUpdate) => ({
      endTimestamp: new Date(Number(weightUpdate.endTimestamp) * 1000),
      startTimestamp: new Date(Number(weightUpdate.startTimestamp) * 1000),
      startWeights: [
        getBigNumberFromString(weightUpdate.startWeights[0]),
        getBigNumberFromString(weightUpdate.startWeights[1]),
      ],
      endWeights: [
        getBigNumberFromString(weightUpdate.endWeights[0]),
        getBigNumberFromString(weightUpdate.endWeights[1]),
      ],
    })),
  };
};