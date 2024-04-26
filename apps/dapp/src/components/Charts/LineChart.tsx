import type { DataKey, AxisDomain } from 'recharts/types/util/types';

import React, { useState } from 'react';
import { useTheme } from 'styled-components';
import {
  CartesianGrid,
  ResponsiveContainer,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ComposedChart,
  Area,
} from 'recharts';
import { formatNumberAbbreviated } from 'utils/formatter';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';

type LineChartProps<T> = {
  chartData: T[];
  xDataKey: DataKey<keyof T>;
  lines: { series: DataKey<keyof T>; color: string; hide?: boolean }[];
  stackedItems?: {
    series: string;
    color: string;
    stackId: string;
    hide?: boolean;
  }[];
  xTickFormatter: (xValue: any, index: number) => string;
  yTickFormatter?: (yValue: any, index: number) => string;
  tooltipLabelFormatter: (value: any) => string;
  tooltipValuesFormatter?: (value: number, name: string) => string[];
  legendFormatter?: (value: string) => string;
  yDomain?: AxisDomain;
  onLegendClick?: (key: string) => void;
};

export default function LineChart<T>(
  props: React.PropsWithChildren<LineChartProps<T>>
) {
  const {
    chartData,
    xDataKey,
    lines,
    stackedItems,
    xTickFormatter,
    yTickFormatter,
    tooltipLabelFormatter,
    tooltipValuesFormatter,
    legendFormatter,
    yDomain,
  } = props;
  const theme = useTheme();

  const [hiddenLines, setHiddenLines] = useState({
    ...Object.fromEntries(
      lines.map((s) => [s.series.toString(), s.hide || false])
    ),
    ...Object.fromEntries(
      stackedItems?.map((s) => [s.series.toString(), s.hide || false]) ?? []
    ),
  });

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

  const isDesktop = useMediaQuery({
    query: queryPhone,
  });
  return (
    <ResponsiveContainer minHeight={200} minWidth={320} height={350}>
      <ComposedChart
        data={chartData}
        margin={{ left: 30 }}
        stackOffset={'sign'}
      >
        <CartesianGrid
          horizontal={true}
          vertical={false}
          stroke={theme.palette.brandDarker}
        />
        {stackedItems?.map((item) => (
          <Area
            key={item.series}
            dataKey={item.series}
            fill={item.color}
            stackId={item.stackId}
            stroke={item.color}
            strokeWidth={2}
            type={'monotone'}
            hide={hiddenLines[item.series.toString()]}
            fillOpacity={0.5}
          />
        ))}
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
          axisLine={false}
          tickLine={false}
          dataKey={xDataKey}
          tickFormatter={xTickFormatter}
          tick={{ stroke: theme.palette.brandLight }}
          minTickGap={10}
          tickMargin={10}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tickFormatter={
            yTickFormatter
              ? (val, i) => yTickFormatter(val, i)
              : (value) => formatNumberAbbreviated(value).string
          }
          tick={{ stroke: theme.palette.brandLight }}
          domain={yDomain}
          tickMargin={10}
        />
        <Tooltip
          wrapperStyle={{ outline: 'none' }}
          separator={isDesktop ? ': ' : ':\n  '}
          contentStyle={{
            backgroundColor: theme.palette.dark75,
            color: theme.palette.brand,
            borderRadius: '15px',
            border: 0,
            minWidth: '180px',
          }}
          itemStyle={{
            backgroundColor: theme.palette.dark75,
            color: theme.palette.brandLight,
            whiteSpace: 'pre',
          }}
          labelStyle={{
            backgroundColor: theme.palette.dark75,
            fontWeight: 'bold',
          }}
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
        {legendFormatter ? (
          <Legend
            verticalAlign="top"
            wrapperStyle={{
              minHeight: '20px',
              height: 'auto',
              padding: '1rem',
            }}
            height={20}
            formatter={legendFormatter}
            onClick={(e) => toggleLineVisibility(e.dataKey)}
          />
        ) : null}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
