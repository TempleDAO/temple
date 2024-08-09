import { useState, useEffect, useRef, useCallback } from 'react';

import { useSubgraphRequest } from 'hooks/use-subgraph-request';
import { Pool } from 'components/Layouts/Ascend/types';
import env from 'constants/env';
import { SubGraphResponse } from 'hooks/core/types';
import { getRemainingTime } from 'components/Pages/Ascend/utils';
import { SubgraphPool, GraphResponse } from 'components/Layouts/Ascend/types';
import { useAuctionContext } from 'components/Pages/Ascend/components/AuctionContext';
import { useVaultContract } from 'components/Pages/Ascend/components/Trade/hooks/use-vault-contract';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';
import { truncateDecimals } from 'utils/formatter';

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
  return useSubgraphRequest<GraphResponse>(
    env.subgraph.balancerV2,
    createLBPQuery(poolAddress)
  );
};

export const usePoolTokenValues = (pool: Pool) => {
  const { vaultAddress, accrued, base } = useAuctionContext();
  const intervalRef = useRef<number>();
  const {
    isReady,
    getSwapQuote: { request: getSwapQuoteRequest, isLoading },
  } = useVaultContract(pool, vaultAddress as any);
  const [spotPrice, setSpotPrice] = useState<string>('0');

  useEffect(() => {
    if (!isReady || !base.address || !accrued.address || intervalRef.current) {
      return;
    }

    const request = async () => {
      try {
        const oneTemple = DecimalBigNumber.parseUnits('1', accrued.decimals);
        const quotes = await getSwapQuoteRequest(
          oneTemple,
          accrued.address as any,
          base.address as any
        );
        const quote = DecimalBigNumber.fromBN(
          quotes[base.tokenIndex].abs(),
          accrued.decimals
        );
        setSpotPrice(quote.formatUnits());
      } catch (err) {
        console.error('err', err);
      }
    };

    request();

    intervalRef.current = window.setInterval(request, env.intervals.ascendData);
  }, [accrued, base, intervalRef, getSwapQuoteRequest, setSpotPrice, isReady]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, [intervalRef]);

  return {
    isLoading: isLoading,
    spotPrice,
    formatted: `${truncateDecimals(spotPrice, 4)} $${base.symbol}`,
    label: `${accrued.symbol} Price`,
  };
};
