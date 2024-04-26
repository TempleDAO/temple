import { useEffect, useMemo, PureComponent } from 'react';
import { format } from 'date-fns';
import styled from 'styled-components';
import {
  FlexibleXYPlot,
  XAxis,
  YAxis,
  LineSeries,
  HorizontalGridLines,
  VerticalGridLines,
  Crosshair,
  ChartLabel,
  DiscreteColorLegend,
  DiscreteColorLegendProps,
} from 'react-vis';
import { curveCatmullRom } from 'd3-shape';

import {
  formatBigNumber,
  getBigNumberFromString,
} from 'components/Vault/utils';
import { formatNumberFixedDecimals } from 'utils/formatter';
import { Pool } from 'components/Layouts/Ascend/types';
import Loader from 'components/Loader/Loader';
import { theme } from 'styles/theme';
import { useAuctionContext } from '../AuctionContext';

import {
  useCrosshairs,
  useLatestPriceData,
  Point,
  useGetFutureDataPoints,
} from './hooks';

interface Props {
  pool: Pool;
}

export const Chart = ({ pool }: Props) => {
  const { balances, accrued } = useAuctionContext();
  const [request, { response, isLoading }] = useLatestPriceData(pool);
  const getFutureDataPoints = useGetFutureDataPoints(pool);

  const { data, yDomain, xDomain, predicted, legend } = useMemo(() => {
    const { joinExits, ...data } = response?.data || {};

    const points = Object.values(data)
      .filter((value) => value.length > 0)
      .map((value) => ({
        x: Number(value[0].timestamp) * 1000,
        y: Number(value[0].price),
      }))
      .sort((a, b) => {
        return a.x - b.x;
      });

    const sortedY = [...points].sort((a, b) => b.y - a.y);
    // might be overwritten by the predicted price
    let ceiling = sortedY[0]?.y || 0;
    const floor = sortedY[sortedY.length - 1]?.y || 0;

    const lastUpdate = pool.weightUpdates[pool.weightUpdates.length - 1];
    const lastUpdateEnd = lastUpdate.endTimestamp.getTime();
    const lastUpdateStart = lastUpdate.startTimestamp.getTime();
    const lbpLength = lastUpdateEnd - lastUpdateStart;
    const xDomain = [lastUpdateStart, lastUpdateEnd + lbpLength * 0.05];

    let predicted: Point[] = [];
    if (balances && points.length > 0) {
      try {
        const lastPoint = points[points.length - 1];
        // only add predicated values if the predicted date is in the future.
        if (lastUpdate.endTimestamp.getTime() > Date.now()) {
          predicted = getFutureDataPoints(lastPoint);

          if (predicted.length > 0) {
            const greatestY = [...predicted].sort((a, b) => b.y - a.y)[0].y;
            if (greatestY > ceiling) {
              ceiling = greatestY;
            }
          }
        }
      } catch (err) {
        // intentionally empty
        console.error('Failed to calculate predicted chart data points');
      }
    }

    const yFloor = floor * 0.45;
    const yDomain =
      points.length > 0 ? [yFloor, ceiling + ceiling * 0.1] : null;
    const yLabel = `$${accrued.symbol} Price`;

    const legend: DiscreteColorLegendProps['items'] = [
      {
        title: yLabel,
        color: theme.palette.brand,
      },
    ];

    if (predicted.length > 0) {
      legend.push({
        title: 'Projected Price',
        color: theme.palette.brandLight,
        strokeStyle: 'dashed',
      });
    }

    return {
      data: points,
      predicted,
      yDomain,
      xDomain,
      yLabel,
      legend,
    };
  }, [pool, response, balances]);

  const { crosshairValues, onMouseLeave, onNearestX } = useCrosshairs([
    data,
    predicted,
  ]);

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
      <FlexibleXYPlot height={400} xType="time" dontCheckIfEmpty>
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
    );
  }

  return (
    <ChartWrapper>
      <FlexibleXYPlot
        xType="time"
        dontCheckIfEmpty
        xDomain={xDomain}
        yDomain={yDomain}
        onMouseLeave={onMouseLeave}
        height={400}
        margin={{ right: 20 }}
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
            text: {
              stroke: 'none',
              fill: theme.palette.brand,
              fontWeight: 600,
            },
          }}
          tickTotal={4}
          tickFormat={(t) => `$${t}`}
        />
        <LineSeries
          data={data}
          color={theme.palette.brand}
          curve={curveCatmullRom}
          // @ts-ignore
          strokeWidth={2}
          onNearestX={(...args) => onNearestX(...args, 'current')}
        />
        <LineSeries
          data={predicted}
          color={theme.palette.brandLight}
          strokeStyle="dashed"
          curve={curveCatmullRom}
          // @ts-ignore
          strokeWidth={1}
          onNearestX={(...args) => onNearestX(...args, 'predicted')}
        />
        <Crosshair
          values={crosshairValues}
          titleFormat={([{ x }]: Point[]) => {
            return {
              title: 'Date',
              value: format(x, 'd LLL'),
            };
          }}
          itemsFormat={([{ y }]: Point[]) => {
            const value = formatNumberFixedDecimals(
              formatBigNumber(getBigNumberFromString(y.toString())),
              4
            );
            return [{ title: 'Price', value }];
          }}
        />
      </FlexibleXYPlot>
      <DiscreteColorLegend orientation="horizontal" items={legend} />
    </ChartWrapper>
  );
};

const ChartWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;

  .rv-crosshair__line {
    background: ${theme.palette.brand50} !important;
  }

  .axis-labels {
    stroke: ${theme.palette.brand75} !important;
    font-size: 0.75rem;
    letter-spacing: 0.12em;
  }

  .rv-discrete-color-legend-item__title {
    stroke: ${theme.palette.brand75} !important;
    color: ${theme.palette.brand75} !important;
  }
`;
