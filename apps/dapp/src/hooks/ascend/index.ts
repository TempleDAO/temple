import { useState, useEffect } from 'react';
import { useContractReads } from 'wagmi';
import { BigNumber } from 'ethers';

import balancerPoolAbi from 'data/abis/balancerPool.json';
import balancerVaultAbi from 'data/abis/balancerVault.json';

import { useSubgraphRequest } from 'hooks/use-subgraph-request';
import { Pool } from 'components/Layouts/Ascend/types';
import env from 'constants/env';
import { SubGraphResponse } from 'hooks/core/types';
import { getRemainingTime, getSpotPrice } from 'components/Pages/Ascend/utils';
import { SubgraphPool, GraphResponse } from 'components/Layouts/Ascend/types';
import { useAuctionContext } from 'components/Pages/Ascend/components/AuctionContext';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';

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
    decimals
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

export const useTemplePools = (limit = 5) => {
  return useSubgraphRequest<TemplePoolsResponse>(env.subgraph.balancerV2, {
    query: `
      query ($owner: String, $limit: Int) {
        pools (first: $limit, orderBy: createTime, orderDirection: "desc",
        where: { totalShares_gte: 0,
                owner: $owner, 
                poolType: "LiquidityBootstrapping" }) {
                  ${POOL_FRAGMENT}
            
        }
      }
    `,
    variables: {
      owner: env.templeMultisig,
      limit,
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

export const usePoolTokenValues = (pool: Pool) => {
  const { swapState: { sell, buy }, balances, weights, vaultAddress } = useAuctionContext();
  const [spotPrice, setSpotPrice] = useState<BigNumber>();

  const { data: swapData, isLoading } = useContractReads({
    contracts: [{
      addressOrName: pool.address,
      contractInterface: balancerPoolAbi,
      functionName: 'getSwapFeePercentage',
    }],
    enabled: !!vaultAddress
  });
  
  const indexOfSell = sell.tokenIndex;
  const indexOfBuy = buy.tokenIndex;
  
  useEffect(() => {
    if (!swapData) {
      return;
    }

    const [swapFee] = swapData;
    if (!swapFee) {
      return;
    }
    
    setSpotPrice(
      getSpotPrice(
        balances[sell.address],
        balances[buy.address],
        weights[sell.address],
        weights[buy.address],
        swapFee as any
      )
    );
  }, [
    balances,
    weights,
    swapData,
    indexOfBuy,
    indexOfSell,
  ]);

  return {
    isLoading,
    spotPrice,
  };
};