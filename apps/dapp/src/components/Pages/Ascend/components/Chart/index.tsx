import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import {
  FlexibleXYPlot,
  XAxis,
  YAxis,
  LineSeries,
  HorizontalGridLines,
  VerticalGridLines,
  Crosshair,
  ChartLabel,
} from 'react-vis';
import { curveCatmullRom } from 'd3-shape';

import { formatBigNumber, getBigNumberFromString } from 'components/Vault/utils';
import { formatNumberFixedDecimals } from 'utils/formatter';
import { useSubgraphRequest } from 'hooks/use-subgraph-request';
import { Pool } from 'components/Layouts/Auction/types';
import env from 'constants/env';
import { SubGraphResponse } from 'hooks/core/types';
import Loader from 'components/Loader/Loader';
import { theme } from 'styles/theme';

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

const useLatestPriceData = (pool: Pool) => {
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

interface Props {
  pool: Pool;
}

interface Point {
  x: number;
  y: number;
}

const useCrosshairs = (data: Point[]) => {
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

export const Chart = ({ pool }: Props) => {
  const [request, { response, isLoading }] = useLatestPriceData(pool);

  const data = Object.values(response?.data || {})
    .filter((value) => value.length > 0)
    .map((value) => ({
      x: Number(value[0].timestamp) * 1000,
      y: Number(value[0].price),
    }));

  const { crosshairValues, onMouseLeave, onNearestX } = useCrosshairs(data);

  useEffect(() => {
    request();
  }, [request]);

  if (isLoading) {
    return (
      <div>
        <Loader />
      </div>
    );
  }

  let numTicks = 0;
  if (data.length > 0) {
    const range = data[data.length - 1].x  - data[0].x;
    numTicks = Math.ceil(range / (1000 * 60 * 60 * 24));
  }

  return (
    <FlexibleXYPlot
      xType="time"
      height={322}
      dontCheckIfEmpty
      onMouseLeave={onMouseLeave}
    >
      {data.length > 0 ? (
        <>
          <HorizontalGridLines
            style={{
              stroke: theme.palette.brand,
            }}
          />
          <VerticalGridLines
            style={{
              stroke: theme.palette.brand,
            }}
            tickTotal={numTicks}
          />
          <XAxis
            style={{
              stroke: theme.palette.brand,
            }}
            tickFormat={(value: number) => {
              return format(value, 'd LLL');
            }}
            tickTotal={numTicks}
          />
          <YAxis
            style={{
              stroke: theme.palette.brand,
            }}
          />
          <LineSeries
            color={theme.palette.brand}
            data={data}
            curve={curveCatmullRom}
            onNearestX={onNearestX}
          />
          <Crosshair
            values={crosshairValues}
            titleFormat={([{ x }]: Point[]) => {
              return ({
                title: 'date',
                value: format(x, 'd LLL'),
              });
            }}
            style={{
              stroke: theme.palette.brandLight
            }}
            itemsFormat={([{ y }]: Point[]) => {
              const value = formatNumberFixedDecimals(formatBigNumber(getBigNumberFromString(`${y}`)), 4);
              return [
                { title: 'price', value },
              ];
            }}
          />
        </>
      ) : (
        <ChartLabel
          text="Not enough data"
          includeMargin={false}
          xPercent={0.5}
          yPercent={0.5}
          style={{
            transform: 'translate(-50, 0)',
          }}
        />
      )}
    </FlexibleXYPlot>
  );
};
