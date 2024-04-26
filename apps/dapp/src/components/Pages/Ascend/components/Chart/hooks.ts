import { useState, useCallback } from 'react';

import { useSubgraphRequest } from 'hooks/use-subgraph-request';
import { Pool } from 'components/Layouts/Ascend/types';
import env from 'constants/env';
import { SubGraphResponse } from 'hooks/core/types';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';
import { useAuctionContext } from '../AuctionContext';
import { formatNumberFixedDecimals } from 'utils/formatter';
import {
  formatBigNumber,
  getBigNumberFromString,
} from 'components/Vault/utils';
import { getSpotPrice } from '../../utils';

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
};

const createTokenPricesQuery = (
  auctionId: string,
  before: number,
  after: number,
  asset: string,
  pricingAsset: string
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
        
        joinExits: joinExits(where: { pool: $auctionId, timestamp_lt: ${after} }) {
          id
          amounts
        }
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
};

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
    accruedAsset
  );

  return useSubgraphRequest<LatestPriceResponse>(
    env.subgraph.balancerV2,
    query
  );
};

export interface Point {
  x: number;
  y: number;
}

export const useCrosshairs = (data: Point[][]) => {
  const [crosshairValues, setCrosshairValues] = useState<Point[]>([]);

  const onMouseLeave = useCallback(() => {
    setCrosshairValues([]);
  }, [setCrosshairValues]);

  const ranges = data.map((range) => {
    if (!range.length) {
      return [];
    }
    return [range[0].x, range[range.length - 1].x];
  });

  const onNearestX = useCallback(
    (
      value: { x: number },
      { index }: { index: number },
      lineSeriesId: 'current' | 'predicted'
    ) => {
      const rangeIndex = ranges.findIndex((range) => {
        return value.x >= range[0] && value.x <= range[1];
      });

      if (lineSeriesId === 'predicted' && rangeIndex === 0) {
        return;
      }

      if (lineSeriesId === 'current' && rangeIndex === 1) {
        return;
      }

      if (rangeIndex === -1) {
        return;
      }

      setCrosshairValues([data[rangeIndex][index]]);
    },
    [setCrosshairValues, data, ranges]
  );

  return { crosshairValues, onMouseLeave, onNearestX };
};

export const useGetFutureDataPoints = (pool: Pool) => {
  const { balances, accrued, base, weights } = useAuctionContext();
  const currentWeights = weights;
  const currentBalances = balances;

  return useCallback(
    (lastPoint: Point) => {
      if (!pool) {
        return [];
      }

      const lastUpdate = pool.weightUpdates[pool.weightUpdates.length - 1];
      const endDate = lastUpdate.endTimestamp.getTime();
      const endWeights = {
        [base.address as any]: lastUpdate.endWeights[base.tokenIndex],
        [accrued.address as any]: lastUpdate.endWeights[accrued.tokenIndex],
      };

      const swapFee = pool.swapFee;
      const oneHourMillis = 1000 * 60 * 60;
      const totalPoints = Math.floor((endDate - lastPoint.x) / oneHourMillis);

      // Weights from the subgraph are formatted differently, need to be reparsed with correct decimals
      const accruedEndWeight = DecimalBigNumber.fromBN(
        endWeights[accrued.address as any].value,
        18
      );
      const accruedCurrentWeight = currentWeights[accrued.address as any];
      const accruedRange = accruedEndWeight.sub(accruedCurrentWeight);
      const interval = accruedRange.div(
        DecimalBigNumber.parseUnits(totalPoints.toString(), 18),
        accruedRange.getDecimals()
      );

      const predicted = [lastPoint];

      let weightAccrued = accruedCurrentWeight;
      let weightBase = currentWeights[base.address as any];
      let currentX = lastPoint.x + oneHourMillis;
      for (let i = 0; i < totalPoints; i++) {
        const priceEstimate = getSpotPrice(
          currentBalances[base.address as any],
          currentBalances[accrued.address as any],
          weightBase,
          weightAccrued,
          swapFee
        );

        predicted.push({
          x: currentX,
          y: formatNumberFixedDecimals(formatBigNumber(priceEstimate), 4),
        });

        currentX += oneHourMillis;
        weightAccrued = weightAccrued.add(interval);
        weightBase = weightBase.sub(interval);
      }

      return predicted;
    },
    [pool, base, accrued, currentBalances, currentWeights]
  );
};
