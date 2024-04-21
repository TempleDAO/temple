import type { DataKey } from 'recharts/types/util/types';

import React from 'react';
import { useTheme } from 'styled-components';
import {
  ResponsiveContainer,
  AreaChart as RechartsChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  formatNumberAbbreviated,
  formatNumberFixedDecimals,
} from 'utils/formatter';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';

type LineChartProps<T> = {
  chartData: T[];
  xDataKey: DataKey<keyof T>;
  lines: {
    series: DataKey<keyof T>;
    color: string;
    yAxisId: 'left' | 'right';
  }[];
  xTickFormatter: (xValue: any, index: number) => string;
  tooltipLabelFormatter: (value: any) => string;
  tooltipValuesFormatter?: (value: number, name: string) => string[];
  legendFormatter?: (value: string) => string;
  xLabel?: string;
};

export default function BiAxialLineChart<T>(
  props: React.PropsWithChildren<LineChartProps<T>>
) {
  const {
    chartData,
    xDataKey,
    lines,
    xTickFormatter,
    tooltipLabelFormatter,
    tooltipValuesFormatter,
    legendFormatter,
    xLabel,
  } = props;
  const theme = useTheme();
  const isDesktop = useMediaQuery({
    query: queryPhone,
  });

  return (
    <ResponsiveContainer minHeight={200} minWidth={320} height={400}>
      <RechartsChart data={chartData}>
        <CartesianGrid
          horizontal={true}
          vertical={false}
          stroke={theme.palette.brandDarker}
        />
        {lines.map((line) => (
          <Area
            key={line.series.toString()}
            type="monotone"
            dataKey={line.series}
            yAxisId={line.yAxisId}
            stroke={line.color}
            fill={line.color}
            fillOpacity={0.3}
            strokeWidth={2}
            dot={false}
            stackId="1"
          />
        ))}
        <XAxis
          axisLine={false}
          tickLine={false}
          dataKey={xDataKey}
          label={{
            value: xLabel,
            position: 'bottom',
            fill: theme.palette.brandLight,
            offset: -15,
          }}
          tickFormatter={xTickFormatter}
          tick={{ stroke: theme.palette.brandLight }}
          height={50}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          yAxisId="right"
          orientation="right"
          tickFormatter={formatTicker}
          tick={{
            stroke: lines.find((line) => line.yAxisId === 'right')?.color,
          }}
          stroke={lines.find((line) => line.yAxisId === 'right')?.color}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          yAxisId="left"
          orientation="left"
          tickFormatter={formatTicker}
          tick={{
            stroke: lines.find((line) => line.yAxisId === 'left')?.color,
          }}
          stroke={lines.find((line) => line.yAxisId === 'left')?.color}
        />
        <Tooltip
          separator={isDesktop ? ': ' : ':\n  '}
          wrapperStyle={{ outline: 'none', opacity: 0.9 }}
          contentStyle={{
            backgroundColor: theme.palette.dark,
            color: theme.palette.brand,
            borderRadius: '15px',
            border: 0,
          }}
          itemStyle={{
            backgroundColor: theme.palette.dark,
            color: theme.palette.brandLight,
            whiteSpace: 'pre',
          }}
          labelStyle={{
            backgroundColor: theme.palette.dark,
            fontWeight: 'bold',
          }}
          labelFormatter={tooltipLabelFormatter}
          formatter={(value, name, _props) => {
            //@ts-ignore
            return tooltipValuesFormatter(value, name);
          }}
        />
        {lines.length > 1 ? (
          <Legend
            wrapperStyle={{
              minHeight: '20px',
              height: 'auto',
              padding: '1rem',
            }}
            verticalAlign="top"
            height={20}
            formatter={legendFormatter}
          />
        ) : null}
      </RechartsChart>
    </ResponsiveContainer>
  );
}

function formatTicker(ticker: any) {
  const abbreviated = formatNumberAbbreviated(ticker);
  return (
    formatNumberFixedDecimals(abbreviated.number, 1) +
    ' ' +
    abbreviated.thousandsSuffix
  );
}
