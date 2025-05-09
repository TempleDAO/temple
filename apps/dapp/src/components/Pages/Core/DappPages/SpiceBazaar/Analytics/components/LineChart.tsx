import type { DataKey, AxisDomain } from 'recharts/types/util/types';
import React, { useState } from 'react';
import styled, { useTheme } from 'styled-components';
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
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';
import box from 'assets/icons/box.svg?react';
import checkbox from 'assets/icons/checkmark-in-box.svg?react';

const EmptyboxIcon = styled(box)`
  width: 24px;
  height: 24px;
`;
const CheckboxIcon = styled(checkbox)`
  width: 18px;
  height: 18px;
`;

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

  const [hiddenLines, setHiddenLines] = useState(
    Object.fromEntries(lines.map((l) => [l.series.toString(), l.hide || false]))
  );

  const toggleLineVisibility = (key: string) => {
    const nextState = {
      ...hiddenLines,
      [key]: !hiddenLines[key],
    };

    const totalLines = Object.values(hiddenLines).length;
    const hiddenCount = Object.values(nextState).filter(Boolean).length;

    if (totalLines - hiddenCount === 0) return;
    setHiddenLines(nextState);
  };

  const isPhoneOrAbove = useMediaQuery({ query: queryPhone });

  return (
    <ResponsiveContainer minHeight={200} minWidth={250} height={350}>
      <ComposedChart
        data={chartData}
        margin={{
          left: isPhoneOrAbove ? 30 : 5,
          top: 0,
          right: 30,
          bottom: 40,
        }}
      >
        <CartesianGrid
          horizontal
          vertical={false}
          stroke={theme.palette.brandDarker}
        />

        {lines.map((line) => (
          <Line
            key={line.series.toString()}
            type="linear"
            dataKey={line.series}
            stroke={line.color}
            strokeWidth={2}
            hide={hiddenLines[line.series.toString()]}
            dot={false}
            activeDot={{
              r: 6,
              fill: theme.palette.brand,
              stroke: theme.palette.brand,
              strokeWidth: 2,
            }}
            isAnimationActive={false}
            connectNulls={false}
          />
        ))}

        <XAxis
          axisLine={false}
          tickLine={false}
          dataKey={xDataKey}
          tickFormatter={xTickFormatter}
          tick={{
            fill: theme.palette.brandLight,
            style: {
              fontFamily: 'Caviar Dreams',
              fontSize: '12px',
              fontWeight: '700',
              lineHeight: '18px',
              letterSpacing: '0.05em',
              whiteSpace: 'collapse',
            },
          }}
          minTickGap={10}
          tickMargin={isPhoneOrAbove ? 30 : 15}
          padding={{ right: 20 }}
        />

        <YAxis
          axisLine={false}
          tickLine={false}
          tick={({ x, y, payload }) => {
            const formatted = yTickFormatter
              ? yTickFormatter(payload.value, payload.index)
              : `$${(payload.value / 1_000_000).toFixed(2)} M`;

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
                {formatted}
              </text>
            );
          }}
          offset={10}
          tickMargin={20}
          domain={yDomain}
        />

        <Tooltip
          wrapperStyle={{ outline: 'none' }}
          formatter={tooltipValuesFormatter}
          labelFormatter={tooltipLabelFormatter}
          cursor={{ stroke: theme.palette.brand, strokeWidth: 2 }}
        />

        {legendFormatter && (
          <Legend
            verticalAlign="top"
            align="center"
            content={({ payload }) => (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '1.5rem',
                  paddingBottom: '30px',
                  paddingRight: '220px',
                  marginTop: '10px',
                }}
              >
                {payload?.map((entry) => {
                  if (!entry.dataKey) return null;

                  const key = entry.dataKey.toString();
                  const isHidden = hiddenLines[key];
                  const color =
                    key === 'epoch1'
                      ? theme.palette.brandLight
                      : key === 'epoch2'
                      ? theme.palette.brandDark
                      : '#D0BE75';

                  return (
                    <div
                      key={key}
                      onClick={() => toggleLineVisibility(key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      {isHidden ? (
                        <EmptyboxIcon width={20} height={20} />
                      ) : (
                        <CheckboxIcon width={20} height={20} />
                      )}
                      <span
                        style={{
                          fontFamily: 'Caviar Dreams',
                          fontSize: '12px',
                          fontWeight: '700',
                          color,
                        }}
                      >
                        {key === 'epoch1'
                          ? 'EPOCH 1'
                          : key === 'epoch2'
                          ? 'EPOCH 2'
                          : 'EPOCH 3'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
