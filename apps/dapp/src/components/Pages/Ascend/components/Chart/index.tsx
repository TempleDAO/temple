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

  const data = useMemo(() => {
    const {joinExists, ...points} = (response?.data || {})

    const dataPoints = Object.values(points)
      .filter((value) => value.length > 0)
      .map((value) => ({
        x: Number(value[0].timestamp) * 1000,
        y: Number(value[0].price),
      }));
    
    const lastUpdate = pool.weightUpdates[pool.weightUpdates.length - 1];
    const start = {
      x: Number(lastUpdate.startTimestamp),
      // y: 
    };

    // const 

    return {
      data,
      yDomain: [0, 1],
      xDomain: [Number(lastUpdate.startTimestamp), Number(lastUpdate.endTimestamp)],
    }
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
  console.log(response)

  let numTicks = 0;
  let updates: any = {}
  if (data.length > 0) {
    updates = pool.weightUpdates[pool.weightUpdates.length - 1];
    console.log('data', data)
  }

  if (!data.data.length ) {
    return null
  }

  return (
    <FlexibleXYPlot
      xType="time"
      dontCheckIfEmpty
      xDomain={data.xDomain}
      yDomain={data.yDomain}
      height={500}
      onMouseLeave={onMouseLeave}
    >
      <HorizontalGridLines
        style={{
          stroke: theme.palette.brand,
        }}
      />
      <VerticalGridLines
        style={{
          stroke: theme.palette.brand,
        }}
      />
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
      <Crosshair
        values={crosshairValues}
        titleFormat={([{ x }]: Point[]) => {
          return ({
            title: 'date',
            value: format(x, 'd LLL'),
          });
        }}
        style={{
          line: {
            stroke: theme.palette.brandLight,
            fill: theme.palette.brandLight,
            path: theme.palette.brandLight,
            color: theme.palette.brandLight,
          },
          title: {},
          box: {}
        }}
        itemsFormat={([{ y }]: Point[]) => {
          const value = formatNumberFixedDecimals(formatBigNumber(getBigNumberFromString(`${y}`)), 4);
          return [
            { title: 'price', value },
          ];
        }}
      />
    </FlexibleXYPlot>
  )

  console.log(data)
  return (
    <FlexibleXYPlot
      xType="time"
      // height={322}
      // width={400}
      dontCheckIfEmpty
      xDomain={updates.endTimestamp ? [Number(updates.startTimestamp), Number(updates.endTimestamp)] : []}
      // yDomain={[0, 1]}
      // onMouseLeave={onMouseLeave}
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
          />
          <XAxis
            style={{
              stroke: theme.palette.brand,
              line: { stroke: '#2b2a2d' },
              ticks: { stroke: '#6b6b76' },
            }}
            tickFormat={(value: number) => {
              return format(value, 'd LLL');
            }}
            tickTotal={data.length + 2}
          />
          <YAxis
            style={{
              line: { stroke: '#2b2a2d' },
              ticks: { stroke: '#6b6b76' },
              text: { stroke: 'none', fill: '#6b6b76', fontWeight: 600 },
            }}
            tickTotal={5}
            tickFormat={(t) => t}
          />
          <LineSeries
            color={theme.palette.brand}
            data={data}
            // @ts-ignore
            strokeWidth={2}
            curve={curveCatmullRom}
            onNearestX={onNearestX}
          />
          {/* <Crosshair
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
          /> */}
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
