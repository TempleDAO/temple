import { useState, useEffect } from 'react';

import { useSubgraphRequest } from 'hooks/use-subgraph-request';
import { Pool } from 'components/Layouts/Ascend/types';
import env from 'constants/env';
import { SubGraphResponse } from 'hooks/core/types';
import { getRemainingTime } from './utils';
import { SubgraphPool, GraphResponse } from 'components/Layouts/Ascend/types';

export const useTimeRemaining = (pool?: Pool) => {
  const [time, setTime] = useState(getRemainingTime(pool));

  useEffect(() => {
    if (!pool || !time) {
      return;
    }

    const id = setTimeout(() => {
      setTime(getRemainingTime(pool));
    }, 1000);

    return () => {
      clearTimeout(id);
    };
  }, [setTime, pool, time]);

  return time;
};

type TemplePoolsResponse = SubGraphResponse<{
  pools: SubgraphPool[];
}>;

const POOL_FRAGMENT = `
  id
  address
  strategyType
  symbol
  name
  swapEnabled
  swapFee
  owner
  totalWeight
  totalSwapVolume
  totalSwapFee
  totalLiquidity
  createTime
  swapsCount
  holdersCount
  tx
  tokensList
  tokens {
    symbol
    name
    address
    weight
    priceRate
    balance
  }
  swaps(first: 1, orderBy: timestamp, orderDirection: desc) {
    timestamp
  }
  weightUpdates(orderBy: scheduledTimestamp, orderDirection: asc) {
    startTimestamp
    endTimestamp
    startWeights
    endWeights
  }
  shares {
    userAddress {
      id
    }
    balance
  }
`;

export const useTemplePools = () => {
  return useSubgraphRequest<TemplePoolsResponse>(env.subgraph.balancerV2, {
    query: `
      query ($owner: String) {
        pools (first: 5, orderBy: createTime, orderDirection: "desc",
        where: { totalShares_gte: 0,
                owner: $owner, 
                poolType: "LiquidityBootstrapping" }) {
                  ${POOL_FRAGMENT}
            
        }
      }
    `,
    variables: {
      owner: env.templeMultisig,
    },
  });
};

const createLBPQuery = (poolAddress: string) => {
  return {
    query: `
      query ($poolAddress: String) {
        pools(where: {address: $poolAddress, poolType: "LiquidityBootstrapping"}) {
          ${POOL_FRAGMENT}
        }
      }
    `,
    variables: {
      poolAddress,
    },
  };
};

export const useTemplePool = (poolAddress = '') => {
  return useSubgraphRequest<GraphResponse>(env.subgraph.balancerV2, createLBPQuery(poolAddress));
};