import React, { useState } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Scatter,
  Cell,
} from 'recharts';
import { useTheme } from 'styled-components';
import { useMediaQuery } from 'react-responsive';
import { formatNumberAbbreviated } from 'utils/formatter';
import { queryPhone } from 'styles/breakpoints';

type DotChartProps<T> = {
  chartData: T[];
  xDataKey: keyof T;
  yDataKey: keyof T;
  isFinalBidKey: keyof T;
  xTicks?: number[]; // Unique X-axis tick values (numeric bucket indices)
  xAxisTitle?: string;
  yAxisTitle?: string;
  yAxisDomain?: [number, number];
  yAxisTicks?: number[];
  xTickFormatter: (xValue: number) => string;
  tooltipLabelFormatter: (value: number) => string;
  tooltipValuesFormatter?: (value: number, name: string, props: any) => string;
};

// Custom dot component
const CustomDot = (props: any) => {
  const { cx, cy, payload, isFinalBidKey, dotColor, finalBidColor } = props;
  const isFinalBid = payload[isFinalBidKey];

  if (isFinalBid) {
    // Final bid: solid gold circle
    return (
      <g>
        {/* Main gold dot */}
        <circle cx={cx} cy={cy} r={9} fill={finalBidColor} opacity={1} />
      </g>
    );
  }

  // Regular bid: solid white dot (no glow)
  return (
    <g>
      {/* Main white dot */}
      <circle cx={cx} cy={cy} r={9} fill={dotColor} opacity={1} />
    </g>
  );
};

export default function BidHistoryDotChart<T>({
  chartData,
  xDataKey,
  yDataKey,
  isFinalBidKey,
  xTicks,
  xAxisTitle,
  yAxisTitle,
  yAxisDomain,
  yAxisTicks,
  xTickFormatter,
  tooltipLabelFormatter,
  tooltipValuesFormatter,
}: React.PropsWithChildren<DotChartProps<T>>) {
  const theme = useTheme();
  const isPhoneOrAbove = useMediaQuery({ query: queryPhone });
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Use theme colors for dots
  const dotColor = theme.palette.light; // White for regular bids
  const finalBidColor = theme.palette.gold; // Gold for final bid

  // Calculate min and max X values for proper domain using both chartData and xTicks
  const dataIndices = chartData.map((d: any) => Number(d[xDataKey]) || 0);
  const tickIndices = (xTicks || [])
    .map((tick) => Number(tick))
    .filter((num) => !isNaN(num));

  const allIndices = [...dataIndices, ...tickIndices];

  const minBucketIndex = allIndices.length > 0 ? Math.min(...allIndices) : 0;
  const maxBucketIndex = allIndices.length > 0 ? Math.max(...allIndices) : 1;

  // Fixed margin for consistent spacing (smaller than gap between buckets for tighter layout)
  const margin = 0.6;

  return (
    <>
      <ResponsiveContainer minHeight={200} minWidth={250} height={350}>
        <ScatterChart
          margin={{
            left: isPhoneOrAbove ? 20 : 15,
            top: 20,
            right: isPhoneOrAbove ? 30 : 5,
            bottom: isPhoneOrAbove ? 30 : 35,
          }}
        >
          <CartesianGrid
            horizontal
            vertical={false}
            stroke={theme.palette.brandDarker}
          />

          <XAxis
            dataKey={xDataKey as string}
            type="number"
            domain={[minBucketIndex - margin, maxBucketIndex + margin]}
            axisLine={false}
            tickLine={false}
            ticks={xTicks}
            tick={({ x, y, payload }) => {
              // payload.value is the bucketIndex, format it using the formatter
              const formatted = xTickFormatter(payload.value);
              return (
                <text
                  key={`x-axis-tick-${payload.value}`}
                  x={x}
                  y={y}
                  textAnchor={isPhoneOrAbove ? 'middle' : 'end'}
                  transform={isPhoneOrAbove ? '' : `rotate(-90, ${x}, ${y})`}
                  fill={theme.palette.brandLight}
                  fontFamily="Caviar Dreams"
                  fontSize={12}
                  fontWeight={700}
                  letterSpacing="0.05em"
                >
                  {formatted}
                </text>
              );
            }}
            minTickGap={10}
            tickMargin={isPhoneOrAbove ? 30 : 10}
            padding={{ left: 20, right: 20 }}
          />

          <YAxis
            dataKey={yDataKey as string}
            type="number"
            scale="linear"
            domain={yAxisDomain}
            ticks={yAxisTicks}
            axisLine={false}
            tickLine={false}
            tick={({ x, y, payload }) => {
              // Format small decimals with appropriate precision
              const value = payload.value;
              let formatted: string;

              if (value === 0) {
                formatted = '0';
              } else if (value < 0.0001) {
                formatted = value.toFixed(6);
              } else if (value < 1) {
                formatted = value.toFixed(4);
              } else {
                const { string } = formatNumberAbbreviated(
                  parseFloat(value.toFixed(2))
                );
                formatted = string;
              }

              return (
                <text
                  key={`y-axis-tick-${payload.value}`}
                  x={x}
                  y={y}
                  dy={10}
                  textAnchor={isPhoneOrAbove ? 'end' : 'middle'}
                  style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    lineHeight: '18px',
                    letterSpacing: '0.05em',
                    fill: theme.palette.brandLight,
                    fontFamily: 'Caviar Dreams',
                  }}
                >
                  <tspan x={x} dy={0}>
                    {formatted}
                  </tspan>
                </text>
              );
            }}
            width={isPhoneOrAbove ? 100 : 60}
            label={{
              value: yAxisTitle || 'TGLD',
              angle: -90,
              position: 'insideLeft',
              style: {
                textAnchor: 'middle',
                fill: theme.palette.brandLight,
                fontFamily: 'Caviar Dreams',
                fontSize: '12px',
                fontWeight: '700',
                letterSpacing: '0.05em',
              },
            }}
          />

          <Tooltip
            wrapperStyle={{
              outline: 'none',
              visibility: activeIndex === null ? 'hidden' : 'visible',
            }}
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload || !payload[0]) return null;

              const data = payload[0].payload;
              const bucketIndex = data[xDataKey];
              // Pass the bucketIndex (numeric) to the formatter
              const label = tooltipLabelFormatter(bucketIndex);
              const content = tooltipValuesFormatter?.(data[yDataKey], '', {
                payload: data,
              });

              return (
                <div
                  style={{
                    background:
                      'linear-gradient(180deg, #353535 45.25%, #101010 87.55%)',
                    boxShadow: '3px 6px 5.5px 0px #00000080',
                    borderRadius: '15px',
                    padding: '12px 16px',
                    minWidth: isPhoneOrAbove ? '180px' : 'auto',
                    maxWidth: isPhoneOrAbove ? 'none' : '90vw',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  <div
                    style={{
                      color: theme.palette.brand,
                      fontSize: '14px',
                      marginBottom: '8px',
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      color: theme.palette.brandLight,
                      fontSize: '12px',
                    }}
                  >
                    {content}
                  </div>
                </div>
              );
            }}
          />

          <Scatter
            name="Bids"
            data={chartData}
            fill={dotColor}
            shape={
              <CustomDot
                isFinalBidKey={isFinalBidKey as string}
                dotColor={dotColor}
                finalBidColor={finalBidColor}
              />
            }
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          />
        </ScatterChart>
      </ResponsiveContainer>
      {xAxisTitle && (
        <div
          style={{
            textAlign: 'center',
            fontFamily: 'Caviar Dreams',
            marginBottom: '10px',
            fontSize: isPhoneOrAbove ? '14px' : '12px',
            fontWeight: 500,
            letterSpacing: '0.05em',
            color: theme.palette.brandLight,
          }}
        >
          {xAxisTitle}
        </div>
      )}
    </>
  );
}
