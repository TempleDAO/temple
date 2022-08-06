import { useEffect, useMemo, PureComponent} from 'react';
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
  LineMarkSeries,
  DiscreteColorLegend,
} from 'react-vis';
import { curveCatmullRom } from 'd3-shape';

import { formatBigNumber, getBigNumberFromString } from 'components/Vault/utils';
import { formatNumberFixedDecimals } from 'utils/formatter';
import { Pool } from 'components/Layouts/Ascend/types';
import Loader from 'components/Loader/Loader';
import { theme } from 'styles/theme';
import { getSpotPrice } from '../../utils';
import { useAuctionContext } from '../AuctionContext';
import { sortAndGroupLBPTokens } from 'utils/balancer';

import { useCrosshairs, useLatestPriceData, Point } from './hooks';

interface Props {
  pool: Pool;
}

export const Chart = ({ pool }: Props) => {
  const { balances } = useAuctionContext();
  const [request, { response, isLoading }] = useLatestPriceData(pool);

  const { data, yDomain, xDomain, predicted, yLabel } = useMemo(() => {
    const {joinExits, ...data} = (response?.data || {})
    const { initialBuySell: { sell, buy } } = sortAndGroupLBPTokens(pool.tokens);

    const points = Object.values(data)
      .filter((value) => value.length > 0)
      .map((value) => ({
        x: Number(value[0].timestamp) * 1000,
        y: Number(value[0].price),
      })).sort((a, b) => {
        return a.x - b.x;
      });

    const greatestPricePoint = [...points].sort((a, b) => b.y - a.y)[0];
    // might be overwritten by the predicted price
    let ceiling = greatestPricePoint?.y || 0;

    const lastUpdate = pool.weightUpdates[pool.weightUpdates.length - 1];
    const lastUpdateEnd = lastUpdate.endTimestamp.getTime();
    const lastUpdateStart = lastUpdate.startTimestamp.getTime();
    const lbpLength = lastUpdateEnd - lastUpdateStart;
    const xDomain = [lastUpdateStart, lastUpdateEnd + (lbpLength * 0.05)];
    
    const predicted = [];
    if (balances && points.length > 0) {
      try {
        const lastPoint = points[points.length - 1];
       
        const spotPriceEstimate = getSpotPrice(
          balances[buy.address]!,
          balances[sell.address]!,
          lastUpdate.endWeights[buy.tokenIndex],
          lastUpdate.endWeights[sell.tokenIndex],
          pool.swapFee
        );

        if (spotPriceEstimate) {
          predicted.push(lastPoint);

          const predictedY = formatNumberFixedDecimals(formatBigNumber(spotPriceEstimate), 4);
          if (predictedY > ceiling) {
            ceiling = predictedY;
          }

          predicted.push({
            y: predictedY,
            x: lastUpdateEnd,
          });
        }
      } catch (err) {
        // intentionally empty
        console.error('Failed to calculate predicted chart data points');
      }
    }

    const yDomain = points.length > 0 ? [0, ceiling + (ceiling * 0.1)] : null;
    
    return {
      data: points,
      predicted,
      yDomain,
      xDomain,
      yLabel: `$${sell.symbol} Price`,
    };
  }, [pool, response, balances]);

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
            text: { stroke: 'none', fill: theme.palette.brand, fontWeight: 600 },
          }}
          tickTotal={4}
          tickFormat={(t) => `$${t}`}
        />
        <CustomAxisLabel title={yLabel} />
        <LineSeries
          data={data}
          color={theme.palette.brand}
          curve={curveCatmullRom}
          // @ts-ignore
          strokeWidth={2}
          onNearestX={onNearestX}
        />
        <LineMarkSeries
          data={predicted}
          color={theme.palette.brandLight}
          strokeStyle="dashed"
          curve={curveCatmullRom}
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
      <DiscreteColorLegend
        orientation="horizontal"
        items={[
          {
            title: yLabel,
            color: theme.palette.brand,
          }, {
            title: 'Projected Price',
            color: theme.palette.brandLight,
            strokeStyle: 'dashed',
          }
        ]}
      />
    </ChartWrapper>
  );
};

// Taken from https://codesandbox.io/s/04741ljm9w?file=/src/zoomable-chart-example.js
class CustomAxisLabel extends PureComponent<any, any> {
  static displayName = 'CustomAxisLabel';
  static requiresSVG = true;

  render() {
    const yLabelOffset = {
      y: this.props.marginTop + this.props.innerHeight / 2 + this.props.title.length * 2,
      x: 10,
    };

    const xLabelOffset = {
      x: this.props.marginLeft + (this.props.innerWidth) / 2 - this.props.title.length * 2,
      y: 1.2 * this.props.innerHeight
    };

    const transform = this.props.xAxis
      ? `translate(${xLabelOffset.x}, ${xLabelOffset.y})`
      : `translate(${yLabelOffset.x}, ${yLabelOffset.y}) rotate(-90)`;

    return (
      <g transform={transform}>
        <text className="unselectable axis-labels">
          {this.props.title}
        </text>
      </g>
    );
  }
}

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