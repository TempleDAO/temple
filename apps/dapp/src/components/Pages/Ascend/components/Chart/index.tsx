import { useEffect } from 'react';
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
import { Pool } from 'components/Layouts/Ascend/types';
import Loader from 'components/Loader/Loader';
import { theme } from 'styles/theme';

import { useCrosshairs, useLatestPriceData, Point } from './hooks';

interface Props {
  pool: Pool;
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
