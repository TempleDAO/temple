import type { DataKey, AxisDomain } from 'recharts/types/util/types';

import React, { useState } from 'react';
import { useTheme } from 'styled-components';
import { ResponsiveContainer, LineChart as RechartsLineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { formatNumberAbbreviated } from 'utils/formatter';

type LineChartProps<T> = {
  chartData: T[];
  xDataKey: DataKey<keyof T>;
  lines: { series: DataKey<keyof T>; color: string; hide?: boolean }[];
  xTickFormatter: (xValue: any, index: number) => string;
  yTickFormatter?: (yValue: any, index: number) => string;
  tooltipLabelFormatter: (value: any) => string;
  tooltipValuesFormatter?: (value: number, name: string) => string[];
  legendFormatter?: (value: string) => string;
  yDomain?: AxisDomain;
  onLegendClick?: (key: string) => void;
};

export default function LineChart<T>(props: React.PropsWithChildren<LineChartProps<T>>) {
  const {
    chartData,
    xDataKey,
    lines,
    xTickFormatter,
    yTickFormatter,
    tooltipLabelFormatter,
    tooltipValuesFormatter,
    legendFormatter,
    yDomain,
  } = props;
  const theme = useTheme();

  const [hiddenLines, setHiddenLines] = useState(
    Object.fromEntries(lines.map((s) => [s.series.toString(), s.hide || false]))
  );

  const toggleLineVisibility = (key: string) => {
    //there must be always at least one visible line
    // otherwise the chart breaks
    const nextState = {
      ...hiddenLines,
      [key]: !hiddenLines[key],
    };

    const totalLines = Object.values(hiddenLines).length;
    const wouldBeHiddenLinesCount = Object.values(nextState).reduce(
      (hiddenCount, isHidden) => (isHidden ? hiddenCount + 1 : hiddenCount),
      0
    );

    if (totalLines - wouldBeHiddenLinesCount === 0) {
      return;
    }
    setHiddenLines(nextState);
  };
  return (
    <ResponsiveContainer minHeight={200} minWidth={320} height={350}>
      <RechartsLineChart data={chartData} margin={{ left: 30 }}>
        {lines.map((line) => (
          <Line
            key={line.series.toString()}
            type="monotone"
            dataKey={line.series}
            stroke={line.color}
            strokeWidth={2}
            dot={false}
            hide={hiddenLines[line.series.toString()]}
          />
        ))}
        <XAxis
          dataKey={xDataKey}
          tickFormatter={xTickFormatter}
          tick={{ stroke: theme.palette.brandLight }}
          minTickGap={10}
          tickMargin={10}
        />
        <YAxis
          tickFormatter={
            yTickFormatter ? (val, i) => yTickFormatter(val, i) : (value) => formatNumberAbbreviated(value).string
          }
          tick={{ stroke: theme.palette.brandLight }}
          domain={yDomain}
          tickMargin={10}
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
          formatter={
            tooltipValuesFormatter
              ? (value, name, _props) => {
                  //@ts-ignore
                  return tooltipValuesFormatter(value, name);
                }
              : undefined
          }
        />
        {lines.length > 1 && legendFormatter ? (
          <Legend
            verticalAlign="top"
            height={20}
            formatter={legendFormatter}
            onClick={(e) => toggleLineVisibility(e.dataKey)}
          />
        ) : null}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
