import { useState, useCallback } from 'react';

import { useSubgraphRequest } from 'hooks/use-subgraph-request';
import { Pool } from 'components/Layouts/Auction/types';
import env from 'constants/env';
import { SubGraphResponse } from 'hooks/core/types';

const createQueryFragment = (after: number, before: number) => {
  return `
    tp_${after}: tokenPrices(
      first: $first,
      skip: $skip,
      orderBy: timestamp,
      orderDirection: desc,
      where: {poolId: $auctionId, timestamp_lt: ${before}, timestamp_gt: ${after}, asset: $asset, pricingAsset: $pricingAsset}
    ) {
      price
      timestamp
    }
  `; 
}

const createTokenPricesQuery = (
  auctionId: string,
  before: number,
  after: number,
  asset: string,
  pricingAsset: string,
) => {
  const fragments: string[] = [];
  
  let currentBefore = after + 3600;
  while (currentBefore < before) {
    fragments.push(createQueryFragment(currentBefore - 3600, currentBefore));
    currentBefore += 3600;
  }
  fragments.push(createQueryFragment(currentBefore - 3600, currentBefore));

  return {
    query: `
      query ($auctionId: String, $first: Int, $skip: Int, $before: Int, $asset: String, $pricingAsset: String) {
        ${fragments.join('\n ')}
      }
    `,
    variables: {
      auctionId,
      before,
      first: 1,
      skip: 0,
      asset,
      pricingAsset,
    },
  };
}

type LatestPriceResponse = SubGraphResponse<{
  [key: string]: {
    price: string;
    timestamp: number;
  }[];
}>;

export const useLatestPriceData = (pool: Pool) => {
  const lastUpdate = pool.weightUpdates[pool.weightUpdates.length - 1];
  const auctionEndSeconds = Number(lastUpdate.endTimestamp) / 1000;
  const auctionStartSeconds = Number(lastUpdate.startTimestamp) / 1000;
  const mainAsset = pool.tokens[0].address;
  const accruedAsset = pool.tokens[1].address;

  const query = createTokenPricesQuery(
    pool.id,
    auctionEndSeconds,
    auctionStartSeconds,
    mainAsset,
    accruedAsset,
  );

  return useSubgraphRequest<LatestPriceResponse>(env.subgraph.balancerV2, query);
};

export interface Point {
  x: number;
  y: number;
}

export const useCrosshairs = (data: Point[]) => {
  const [crosshairValues, setCrosshairValues] = useState<Point[]>([]);

  const onMouseLeave = useCallback(
    () => setCrosshairValues([]),
    [setCrosshairValues]
  );

  const onNearestX = useCallback(
    (_value, { index }) => {
      setCrosshairValues([data[index]]);
    },
    [setCrosshairValues, data]
  );

  return { crosshairValues, onMouseLeave, onNearestX };
}
