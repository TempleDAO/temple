import type { ScaleType, DataKey } from 'recharts/types/util/types';

import React from 'react';
import { useTheme } from 'styled-components';
import { ResponsiveContainer, AreaChart as RechartsChart, Area, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { formatNumberAbbreviated } from 'utils/formatter';

type LineChartProps<T> = {
  chartData: T[];
  xDataKey: DataKey<keyof T>;
  lines: { series: DataKey<keyof T>; color: string; yAxisId: 'left' | 'right' }[];
  xTickFormatter: (xValue: any, index: number) => string;
  tooltipLabelFormatter: (value: any) => string;
  tooltipValuesFormatter?: (value: number, name: string) => string[];
  legendFormatter?: (value: string) => string;
  scaleX?: ScaleType;
};

export default function BiAxialLineChart<T>(props: React.PropsWithChildren<LineChartProps<T>>) {
  const { chartData, xDataKey, lines, xTickFormatter, tooltipLabelFormatter, tooltipValuesFormatter, legendFormatter } =
    props;
  const theme = useTheme();

  return (
    <ResponsiveContainer minHeight={200} minWidth={320} height={350}>
      <RechartsChart data={chartData}>
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
          />
        ))}
        <XAxis dataKey={xDataKey} tickFormatter={xTickFormatter} tick={{ stroke: theme.palette.brandLight }} />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickFormatter={(value) => formatNumberAbbreviated(value)}
          tick={{ stroke: lines.find((line) => line.yAxisId === 'right')?.color }}
          stroke={lines.find((line) => line.yAxisId === 'right')?.color}
        />
        <YAxis
          yAxisId="left"
          orientation="left"
          tickFormatter={(value) => formatNumberAbbreviated(value)}
          tick={{ stroke: lines.find((line) => line.yAxisId === 'left')?.color }}
          stroke={lines.find((line) => line.yAxisId === 'left')?.color}
        />
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
          formatter={(value, name, _props) => {
            //@ts-ignore
            return tooltipValuesFormatter(value, name);
          }}
        />
        {lines.length > 1 ? <Legend verticalAlign="top" height={20} formatter={legendFormatter} /> : null}
      </RechartsChart>
    </ResponsiveContainer>
  );
}
