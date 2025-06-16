import type { DataKey, AxisDomain } from 'recharts/types/util/types';
import React from 'react';
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
} from 'recharts';
import { formatNumberAbbreviated } from 'utils/formatter';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';

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

export default function LineChart<T>(
  props: React.PropsWithChildren<LineChartProps<T>>
) {
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

  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });
  return (
    <ResponsiveContainer minHeight={200} minWidth={250} height={350}>
      <ComposedChart
        data={chartData}
        margin={{
          left: isPhoneOrAbove ? 50 : 5,
          top: 20,
          right: 30,
          bottom: 20,
        }}
        stackOffset={'sign'}
      >
        <CartesianGrid
          horizontal={true}
          vertical={false}
          stroke={theme.palette.brandDarker}
        />
        {lines.map((line) => (
          <Line
            key={line.series.toString()}
            type="bumpX"
            dataKey={line.series}
            stroke={line.color}
            strokeWidth={2}
            dot={false}
          />
        ))}
        <XAxis
          axisLine={false}
          tickLine={true}
          type="category"
          minTickGap={10}
          allowDuplicatedCategory={false}
          dataKey={xDataKey}
          tick={({ x, y, payload }) => {
            const value = xTickFormatter
              ? xTickFormatter(payload.value, payload.index)
              : payload.value;

            if (!isPhoneOrAbove) {
              const words = value.split(' ');
              return (
                <text
                  x={x}
                  y={y}
                  textAnchor="start"
                  style={{
                    fontFamily: 'Caviar Dreams',
                    fontSize: '12px',
                    fontWeight: '700',
                    lineHeight: '18px',
                    letterSpacing: '0.05em',
                    fill: theme.palette.brandLight,
                  }}
                >
                  {words.map((word: string) => (
                    <tspan
                      key={word}
                      x={x}
                      dy={words.indexOf(word) === 0 ? 0 : 18}
                    >
                      {word}
                    </tspan>
                  ))}
                </text>
              );
            }
            return (
              <text
                x={x}
                y={y}
                dy={10}
                textAnchor="start"
                style={{
                  fontFamily: 'Caviar Dreams',
                  fontSize: '12px',
                  fontWeight: '700',
                  lineHeight: '18px',
                  letterSpacing: '0.05em',
                  fill: theme.palette.brandLight,
                }}
              >
                {value}
              </text>
            );
          }}
          tickMargin={isPhoneOrAbove ? 30 : 15}
          interval={0}
          padding={{ right: 20 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={({ x, y, payload }) => {
            const formattedValue = yTickFormatter
              ? yTickFormatter(payload.value, payload.index)
              : `${formatNumberAbbreviated(payload.value).number.toFixed(
                  2
                )} USDS`;

            const words = formattedValue.split(' ');
            return (
              <text
                x={x}
                y={y}
                dy={10}
                textAnchor={isPhoneOrAbove ? 'end' : 'middle'}
                transform={isPhoneOrAbove ? '' : `rotate(-90, ${x}, ${y})`}
                style={{
                  fontSize: '12px',
                  fontWeight: '700',
                  lineHeight: '18px',
                  letterSpacing: '0.05em',
                  fill: theme.palette.brandLight,
                  fontFamily: 'Caviar Dreams',
                }}
              >
                {!isPhoneOrAbove ? (
                  words.map((word: string) => (
                    <tspan
                      key={word}
                      x={x}
                      dy={words.indexOf(word) === 0 ? 0 : '15'}
                    >
                      {word}
                    </tspan>
                  ))
                ) : (
                  <tspan x={x} dy={0}>
                    {formattedValue}
                  </tspan>
                )}
              </text>
            );
          }}
          offset={10}
          domain={yDomain}
          // ticks={[5.30, 5.35, 5.40, 5.45]}
          tickMargin={isPhoneOrAbove ? 20 : 40}
        />
        <Tooltip
          wrapperStyle={{ outline: 'none' }}
          separator={isPhoneOrAbove ? ': ' : ':\n  '}
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
          />
        ) : null}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
