import type { DataKey } from 'recharts/types/util/types';

import React from 'react';
import styled from 'styled-components';
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
  xLabel?: string;
};

export default function BiAxialLineChart<T>(props: React.PropsWithChildren<LineChartProps<T>>) {
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

  return (
    <ResponsiveContainer minHeight={200} minWidth={320} height={400}>
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
            stackId="1"
          />
        ))}
        <XAxis
          dataKey={xDataKey}
          label={{ value: xLabel, position: 'bottom', fill: theme.palette.brandLight, offset: -15 }}
          tickFormatter={xTickFormatter}
          tick={{ stroke: theme.palette.brandLight }}
          height={50}
        />
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

const Label = styled.label`
  display: flex;
  margin-top: 30px;
  color: white;
`;
