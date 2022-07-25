import { useEffect, useMemo } from 'react';
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
  LineMarkSeries,
} from 'react-vis';
import { curveCatmullRom } from 'd3-shape';

import { formatBigNumber, getBigNumberFromString } from 'components/Vault/utils';
import { formatNumberFixedDecimals } from 'utils/formatter';
import { Pool } from 'components/Layouts/Ascend/types';
import Loader from 'components/Loader/Loader';
import { theme } from 'styles/theme';
import { getSpotPrice } from '../../utils';
import { useAuctionContext } from '../AuctionContext';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';

import { useCrosshairs, useLatestPriceData, Point } from './hooks';

interface Props {
  pool: Pool;
}

export const Chart = ({ pool }: Props) => {
  const { balances } = useAuctionContext();
  const [request, { response, isLoading }] = useLatestPriceData(pool);

  const { data, yDomain, xDomain, predicted } = useMemo(() => {
    const {joinExits, ...data} = (response?.data || {})

    const points = Object.values(data)
      .filter((value) => value.length > 0)
      .map((value) => ({
        x: Number(value[0].timestamp) * 1000,
        y: Number(value[0].price),
      }));

    const lastUpdate = pool.weightUpdates[pool.weightUpdates.length - 1];
    const lastUpdateEnd = lastUpdate.endTimestamp.getTime();
    const lastUpdateStart = lastUpdate.startTimestamp.getTime();
    const lbpLength = lastUpdateEnd - lastUpdateStart;

    const sortedDesc = points.sort((a, b) => b.y - a.y);
    const ceiling = sortedDesc.length > 0 ? sortedDesc[0].y : 0;
    const yDomain = points.length > 0 ? [0, ceiling + (ceiling * 0.1)] : null;
   
    const [buy, sell] = pool.tokensList;
    const predicted = [];
    if (balances) {
      try {
        const spotPriceEstimate = getSpotPrice(
          balances[sell]!,
          balances[buy]!,
          DecimalBigNumber.fromBN(lastUpdate.endWeights[1], 18),
          DecimalBigNumber.fromBN(lastUpdate.endWeights[0], 18),
          pool.swapFee
        );

        if (spotPriceEstimate) {
          predicted.push({
            y: points[points.length - 1].y,
            x: points[points.length - 1].x,
          });

          predicted.push({
            y: formatNumberFixedDecimals(formatBigNumber(spotPriceEstimate), 4),
            x: lastUpdateEnd,
          });
        }
      } catch (err) {
        // intentionally empty
      }
    }
    
    return {
      data: points,
      predicted,
      yDomain,
      xDomain: [lastUpdateStart, lastUpdateEnd + (lbpLength * 0.05)],
    };
  }, [pool, response]);

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

  if (!data.length) {
    return (
      <FlexibleXYPlot
        height={400}
        xType="time"
        dontCheckIfEmpty
      >
        <ChartLabel
          text="Not enough data"
          includeMargin={false}
          xPercent={0.5}
          yPercent={0.5}
          style={{
            transform: 'translate(-50, 0)',
          }}
        />
      </FlexibleXYPlot>
    )
  }

  return (
    <FlexibleXYPlot
      xType="time"
      dontCheckIfEmpty
      xDomain={xDomain}
      yDomain={yDomain}
      onMouseLeave={onMouseLeave}
      height={400}
      margin={{ right: 20}}
    >
      <VerticalGridLines style={{ stroke: theme.palette.brand25 }} />
      <HorizontalGridLines style={{ stroke: theme.palette.brand25 }} />
      <XAxis
        style={{
          line: { stroke: theme.palette.brand },
          ticks: { stroke: theme.palette.brand },
          stroke: theme.palette.brand,
          text: {
            stroke: 'none',
            fill: theme.palette.brand,
            fontSize: 10,
          },
        }}
        tickTotal={8}
      />
      <YAxis
        style={{
          line: { stroke: theme.palette.brand },
          ticks: { stroke: theme.palette.brand },
          text: { stroke: 'none', fill: theme.palette.brand, fontWeight: 600 },
        }}
        tickTotal={4}
        tickFormat={(t) => `$${t}`}
      />
      <LineSeries
        data={data}
        color={theme.palette.brand }
        curve={curveCatmullRom}
        // @ts-ignore
        strokeWidth={2}
        onNearestX={onNearestX}
      />
      <LineMarkSeries
        data={predicted}
        color={theme.palette.brandLight}
        curve={curveCatmullRom}
        strokeStyle="dashed"
        // @ts-ignore
        strokeWidth={1}
      />
      <Crosshair
        values={crosshairValues}
        titleFormat={([{ x }]: Point[]) => {
          return ({
            title: 'date',
            value: format(x, 'd LLL'),
          });
        }}
        itemsFormat={([{ y }]: Point[]) => {
          const value = formatNumberFixedDecimals(formatBigNumber(getBigNumberFromString(`${y}`)), 4);
          return [
            { title: 'price', value },
          ];
        }}
      />
    </FlexibleXYPlot>
  );
};
