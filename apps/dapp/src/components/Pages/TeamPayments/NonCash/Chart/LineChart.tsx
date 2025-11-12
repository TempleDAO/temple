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
import { createGlobalStyle } from 'styled-components';

export const GlobalChartStyles = createGlobalStyle`
  .recharts-tooltip-cursor {
    stroke: ${({ theme }) => theme.palette.brand};
    stroke-width: 2;
  }
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
  yTicks?: number[];
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
    yTicks,
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
          top: 20,
          right: 30,
          bottom: 40,
        }}
      >
        <CartesianGrid
          horizontal={true}
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
            connectNulls={true}
            dot={false}
            activeDot={{
              r: 6,
              fill: theme.palette.brand,
              stroke: theme.palette.brand,
              strokeWidth: 2,
            }}
            isAnimationActive={false}
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
            },
          }}
          minTickGap={10}
          tickMargin={isPhoneOrAbove ? 30 : 15}
          padding={{ right: 20 }}
          label={{
            value: 'Month',
            position: 'insideBottom',
            offset: -40,
            style: {
              fontFamily: 'Caviar Dreams',
              fontSize: '12px',
              fontWeight: '700',
              fill: theme.palette.brandLight,
            },
          }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={({ x, y, payload }) => {
            const formatted = yTickFormatter
              ? yTickFormatter(payload.value, payload.index)
              : `${(payload.value / 1_000_000).toFixed(1)} M TGLD`;

            const lines = formatted.split('\n');
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
                {lines.map((line, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <tspan key={i} x={x} dy={i === 0 ? 0 : 15}>
                    {line}
                  </tspan>
                ))}
              </text>
            );
          }}
          offset={10}
          domain={yDomain}
          ticks={yTicks}
          tickMargin={20}
        />
        <Tooltip
          wrapperStyle={{ outline: 'none' }}
          content={({ active, payload, label }) => {
            if (!active || !payload || !payload.length) return null;

            // Calculate total from all vests
            const total = payload.reduce(
              (sum, p) => sum + (Number(p.value) || 0),
              0
            );

            return (
              <div
                style={{
                  background:
                    'linear-gradient(180deg, #353535 45.25%, #101010 87.55%)',
                  boxShadow: '3px 6px 5.5px 0px #00000080',
                  color: theme.palette.brand,
                  borderRadius: '15px',
                  padding: '1rem',
                  minWidth: '200px',
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '14px',
                    color: theme.palette.brand,
                    marginBottom: '0.5rem',
                  }}
                >
                  {tooltipLabelFormatter ? tooltipLabelFormatter(label) : label}
                </div>
                {payload.map((p) => {
                  const value = Number(p.value) || 0;
                  const [formattedValue, formattedLabel] =
                    tooltipValuesFormatter
                      ? tooltipValuesFormatter(value, p.dataKey as string)
                      : [value.toLocaleString(), p.dataKey];

                  return (
                    <div
                      key={p.dataKey}
                      style={{
                        background: 'transparent',
                        fontWeight: 700,
                        fontSize: '12px',
                        lineHeight: '18px',
                        color: theme.palette.brandLight,
                      }}
                    >
                      {formattedLabel}: {formattedValue}
                    </div>
                  );
                })}
                <div
                  style={{
                    background: 'transparent',
                    fontWeight: 700,
                    fontSize: '12px',
                    lineHeight: '18px',
                    color: theme.palette.brandLight,
                    marginTop: '0.5rem',
                    paddingTop: '0.5rem',
                    borderTop: `1px solid ${theme.palette.brand}`,
                  }}
                >
                  Total TGLD Vested: {total.toLocaleString()}
                </div>
              </div>
            );
          }}
        />
        {legendFormatter && (
          <Legend
            verticalAlign="top"
            align="right"
            content={({ payload }) => (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '1.5rem',
                  paddingBottom: '30px',
                  marginTop: '10px',
                }}
              >
                {payload?.map((entry) => {
                  if (!entry.dataKey) return null;

                  const key = entry.dataKey.toString();
                  const isHidden = hiddenLines[key];
                  const color = entry.color || theme.palette.brandLight;
                  const label = legendFormatter ? legendFormatter(key) : key;

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
                      {isHidden ? <EmptyboxIcon /> : <CheckboxIcon />}
                      <span
                        style={{
                          fontFamily: 'Caviar Dreams',
                          fontSize: '12px',
                          fontWeight: '700',
                          color,
                        }}
                      >
                        {label}
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

const EmptyboxIcon = styled(box)`
  width: 18px;
  height: 18px;
`;
const CheckboxIcon = styled(checkbox)`
  width: 18px;
  height: 18px;
`;
