import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Cell,
} from 'recharts';
import { useTheme } from 'styled-components';
import { useMediaQuery } from 'react-responsive';
import { formatNumberAbbreviated } from 'utils/formatter';
import { queryPhone } from 'styles/breakpoints';

type BarChartProps<T> = {
  chartData: T[];
  xDataKey: keyof T;
  yDataKey: keyof T;
  xAxisTitle?: string;
  yAxisTitle?: string;
  yAxisDomain?: [number, number];
  yAxisTicks?: number[];
  xTickFormatter: (xValue: any, index: number) => string;
  yTickFormatter?: (yValue: any, index: number) => string;
  tooltipLabelFormatter: (value: any) => string;
  tooltipValuesFormatter?: (value: number, name: string) => string[];
};

export default function CustomBarChart<T>({
  chartData,
  xDataKey,
  yDataKey,
  xAxisTitle,
  yAxisDomain,
  yAxisTicks,
  xTickFormatter,
  tooltipLabelFormatter,
  tooltipValuesFormatter,
}: React.PropsWithChildren<BarChartProps<T>>) {
  const theme = useTheme();
  const isPhoneOrAbove = useMediaQuery({ query: queryPhone });

  const barColors = [
    '#FFE3D4',
    '#DCD28B',
    '#C38557',
    '#8F5F3B',
    '#9882C1',
    '#4E87A0',
    '#348877',
  ];

  return (
    <>
      <ResponsiveContainer minHeight={200} minWidth={250} height={350}>
        <BarChart
          data={chartData}
          barSize={56}
          barCategoryGap={20}
          margin={{
            left: isPhoneOrAbove ? 12 : 5,
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
            interval={0}
            axisLine={false}
            tickLine={false}
            tick={({ x, y, payload, index }) => {
              const formatted = xTickFormatter(payload.value, payload.index);
              const [line1, line2] = formatted.split(' ');
              return (
                <text
                  key={`x-axis-tick-${payload.value}-${index}`}
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
                  {isPhoneOrAbove ? (
                    <>
                      <tspan x={x} dy="0">
                        {line1}
                      </tspan>
                      <tspan x={x} dy="15">
                        {line2}
                      </tspan>
                    </>
                  ) : (
                    formatted
                  )}
                </text>
              );
            }}
            minTickGap={10}
            tickMargin={isPhoneOrAbove ? 30 : 10}
            padding={{ right: 20 }}
          />

          <YAxis
            type="number"
            scale="linear"
            domain={yAxisDomain}
            ticks={yAxisTicks}
            axisLine={false}
            tickLine={false}
            tick={({ x, y, payload }) => {
              const { string } = formatNumberAbbreviated(payload.value);
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
                    {`$${string}`}
                  </tspan>
                </text>
              );
            }}
            offset={20}
            tickMargin={30}
          />

          <Tooltip
            wrapperStyle={{ outline: 'none' }}
            separator={isPhoneOrAbove ? ': ' : ':\n  '}
            cursor={false}
            contentStyle={{
              background:
                'linear-gradient(180deg, #353535 45.25%, #101010 87.55%)',
              boxShadow: '3px 6px 5.5px 0px #00000080',
              color: theme.palette.brand,
              borderRadius: '15px',
              border: 0,
              padding: '12px 16px',
              minWidth: '180px',
            }}
            itemStyle={{
              background: 'transparent',
              color: theme.palette.brandLight,
              fontSize: '12px',
            }}
            labelStyle={{
              background: 'transparent',
              color: theme.palette.brand,
              fontSize: '14px',
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

          <Bar
            dataKey={yDataKey as string}
            radius={[6, 6, 6, 6]}
            activeBar={{
              // <-- This is always applied
              stroke: '#FFFFFF',
              strokeWidth: 2,
            }}
          >
            {chartData.map((_, index) => (
              <Cell
                // eslint-disable-next-line react/no-array-index-key
                key={`cell-${index}`}
                fill={barColors[index % barColors.length]}
              />
            ))}
          </Bar>
        </BarChart>
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
