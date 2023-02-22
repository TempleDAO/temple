import type { FC } from 'react';
import type { ScaleType, DataKey } from 'recharts/types/util/types';

import React from 'react';
import { useTheme } from 'styled-components';
import { ResponsiveContainer, LineChart as RechartsLineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { formatNumberAbbreviated } from 'utils/formatter';

type LineChartProps<T> = {
  chartData: T[];
  xDataKey: DataKey<keyof T>;
  yDataKey: DataKey<keyof T>;
  xTickFormatter: (xValue: any) => string;
  scaleX?: ScaleType;
};

export function LineChart<T>(props: React.PropsWithChildren<LineChartProps<T>>) {
  const { chartData, xDataKey, yDataKey, scaleX = 'time', xTickFormatter } = props;
  const theme = useTheme();
  return (
    <ResponsiveContainer minHeight={200} minWidth={320} height={350}>
      <RechartsLineChart data={chartData}>
        <Line type="monotone" dataKey={yDataKey} stroke={theme.palette.brand} strokeWidth={4} dot={false} />
        <XAxis
          dataKey={xDataKey}
          scale={scaleX}
          tickFormatter={xTickFormatter}
          tick={{ stroke: theme.palette.brandLight }}
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
          labelFormatter={(label) => xTickFormatter(label)}
        />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
