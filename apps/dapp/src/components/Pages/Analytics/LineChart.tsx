import type { ScaleType, DataKey } from 'recharts/types/util/types';

import React from 'react';
import { useTheme } from 'styled-components';
import { ResponsiveContainer, LineChart as RechartsLineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { formatNumberAbbreviated } from 'utils/formatter';

type LineChartProps<T> = {
  chartData: T[];
  xDataKey: DataKey<keyof T>;
  lines: { series: DataKey<keyof T>; color: string }[];
  xTickFormatter: (xValue: any, index: number) => string;
  tooltipLabelFormatter: (value: any) => string;
  scaleX?: ScaleType;
};

export function LineChart<T>(props: React.PropsWithChildren<LineChartProps<T>>) {
  const { chartData, xDataKey, lines, scaleX = 'time', xTickFormatter, tooltipLabelFormatter } = props;
  const theme = useTheme();
  return (
    <ResponsiveContainer minHeight={200} minWidth={320} height={350}>
      <RechartsLineChart data={chartData}>
        {lines.map((line) => (
          <Line type="monotone" dataKey={line.series} stroke={line.color} strokeWidth={4} dot={false} />
        ))}
        <XAxis
          dataKey={xDataKey}
          scale={scaleX}
          tickFormatter={xTickFormatter}
          tick={{ stroke: theme.palette.brandLight }}
          minTickGap={25}
        />
        <YAxis tickFormatter={(value) => formatNumberAbbreviated(value)} tick={{ stroke: theme.palette.brandLight }} />
        <Tooltip
          wrapperStyle={{ outline: 'none' }}
          contentStyle={{
            backgroundColor: theme.palette.dark75,
            color: theme.palette.brand,
            borderRadius: '15px',
            border: 0,
          }}
          itemStyle={{ backgroundColor: theme.palette.dark75, color: theme.palette.brandLight }}
          labelStyle={{ backgroundColor: theme.palette.dark75, fontWeight: 'bold' }}
          labelFormatter={tooltipLabelFormatter}
        />
        {lines.length > 1 ? <Legend verticalAlign="top" height={36} /> : null}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
