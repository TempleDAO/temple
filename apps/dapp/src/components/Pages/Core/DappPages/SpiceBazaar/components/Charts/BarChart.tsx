import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import styled, { useTheme } from 'styled-components';
import { useMediaQuery } from 'react-responsive';
import { formatNumberAbbreviated } from 'utils/formatter';
import { queryPhone } from 'styles/breakpoints';
import { ScrollBar } from 'components/Pages/Core/DappPages/SpiceBazaar/components/CustomScrollBar';
import type { BarChartProps } from './types';

const DEFAULT_BAR_COLORS = [
  '#FFE3D4',
  '#DCD28B',
  '#C38557',
  '#8F5F3B',
  '#9882C1',
  '#4E87A0',
  '#348877',
];

export default function CustomBarChart<T>({
  chartData,
  xDataKey,
  yDataKey,
  xAxisTitle,
  yAxisTitle,
  yAxisDomain,
  yAxisTicks,
  xTickFormatter,
  yTickFormatter,
  tooltipLabelFormatter,
  tooltipValuesFormatter,
  barColors = DEFAULT_BAR_COLORS,
}: React.PropsWithChildren<BarChartProps<T>>) {
  const theme = useTheme();
  const isPhoneOrAbove = useMediaQuery({ query: queryPhone });
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const yAxisNumberFormatter = useMemo(
    () => new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 }),
    []
  );

  const getYAxisLabel = useCallback(
    (value: number, index: number) => {
      if (yTickFormatter) return yTickFormatter(value, index);
      const abbreviated = formatNumberAbbreviated(value);
      if (abbreviated.thousandsSuffix) {
        return abbreviated.string;
      }
      return yAxisNumberFormatter.format(value);
    },
    [yTickFormatter, yAxisNumberFormatter]
  );

  const yAxisWidth = useMemo(() => {
    const values =
      yAxisTicks && yAxisTicks.length
        ? yAxisTicks
        : chartData.map((entry) => Number(entry[yDataKey] ?? 0));
    let maxLength = 0;

    values.forEach((value, index) => {
      const numericValue = typeof value === 'number' ? value : Number(value);
      if (Number.isNaN(numericValue)) return;
      const label = getYAxisLabel(numericValue, index);
      maxLength = Math.max(maxLength, label.length);
    });

    const estimatedCharWidth = isPhoneOrAbove ? 7 : 6;
    const padding = isPhoneOrAbove ? 22 : 16;
    const maxWidth = isPhoneOrAbove ? 220 : 160;
    return Math.min(
      maxWidth,
      Math.max(60, maxLength * estimatedCharWidth + padding)
    );
  }, [chartData, yAxisTicks, yDataKey, getYAxisLabel, isPhoneOrAbove]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [chartData]);

  const marginLeft = isPhoneOrAbove ? 30 : 0;
  const marginRight = isPhoneOrAbove ? 30 : 5;
  const marginTop = 20;
  const marginBottom = isPhoneOrAbove ? 30 : 35;

  const yAxisChartWidth = yAxisWidth + marginLeft;
  const minBarWidth = 36;
  const barCategoryGap = 0.1;
  const minChartWidth = Math.max(
    250,
    Math.ceil(chartData.length * (minBarWidth / (1 - barCategoryGap))) +
      marginRight
  );

  return (
    <>
      <div style={{ position: 'relative', paddingLeft: '40px' }}>
        {yAxisTitle && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%) rotate(-90deg)',
              transformOrigin: 'center',
              whiteSpace: 'nowrap',
              fontFamily: 'Caviar Dreams',
              fontSize: isPhoneOrAbove ? '14px' : '12px',
              fontWeight: 500,
              letterSpacing: '0.05em',
              color: theme.palette.brandLight,
            }}
          >
            {yAxisTitle}
          </div>
        )}
        <div style={{ display: 'flex' }}>
          {/* Fixed Y-axis — never scrolls */}
          <BarChart
            width={yAxisChartWidth}
            height={350}
            data={chartData}
            margin={{
              left: marginLeft,
              top: marginTop,
              right: 0,
              bottom: marginBottom,
            }}
          >
            <XAxis
              dataKey={xDataKey as string}
              axisLine={false}
              tickLine={false}
              tick={false}
              tickMargin={isPhoneOrAbove ? 30 : 100}
            />
            <YAxis
              type="number"
              scale="linear"
              domain={yAxisDomain}
              ticks={yAxisTicks}
              axisLine={false}
              tickLine={false}
              width={yAxisWidth}
              tick={({ x, y, payload, index }) => (
                <text
                  key={`y-axis-tick-${payload.value}`}
                  x={x}
                  y={y}
                  dy={10}
                  textAnchor="end"
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
                    {getYAxisLabel(payload.value, index)}
                  </tspan>
                </text>
              )}
              offset={20}
              tickMargin={30}
            />
          </BarChart>

          {/* Scrollable bar area */}
          <ChartScrollBar
            autoHide={false}
            scrollableNodeProps={{ ref: scrollRef }}
          >
            <div style={{ minWidth: minChartWidth }}>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart
                  data={chartData}
                  margin={{
                    left: 0,
                    top: marginTop,
                    right: marginRight,
                    bottom: marginBottom,
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
                      const formatted = xTickFormatter(
                        payload.value,
                        payload.index
                      );
                      const [line1, line2] = formatted.split(' ');
                      return (
                        <text
                          key={`x-axis-tick-${payload.value}-${index}`}
                          x={x}
                          y={y}
                          textAnchor={isPhoneOrAbove ? 'middle' : 'end'}
                          transform={
                            isPhoneOrAbove ? '' : `rotate(-90, ${x}, ${y})`
                          }
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
                    tickMargin={isPhoneOrAbove ? 30 : 100}
                    padding={{ right: 20 }}
                  />

                  <YAxis
                    hide
                    width={0}
                    domain={yAxisDomain}
                    ticks={yAxisTicks}
                  />

                  <Tooltip
                    wrapperStyle={{
                      outline: 'none',
                      visibility: activeIndex === null ? 'hidden' : 'visible',
                    }}
                    cursor={false}
                    contentStyle={{
                      background:
                        'linear-gradient(180deg, #353535 45.25%, #101010 87.55%)',
                      boxShadow: '3px 6px 5.5px 0px #00000080',
                      color: theme.palette.brand,
                      borderRadius: '15px',
                      border: 0,
                      padding: '12px 16px',
                      minWidth: isPhoneOrAbove ? '180px' : 'auto',
                      maxWidth: isPhoneOrAbove ? 'none' : '90vw',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
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
                        ? (value: any, name: any) =>
                            tooltipValuesFormatter(
                              value as number,
                              name as string
                            )
                        : undefined
                    }
                  />

                  <Bar
                    dataKey={yDataKey as string}
                    radius={[6, 6, 6, 6]}
                    barSize={minBarWidth}
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    {chartData.map((entry: T, index) => {
                      const key =
                        typeof entry === 'object' && entry !== null
                          ? `cell-${String(entry[xDataKey])}`
                          : `cell-${index}`;
                      return (
                        <Cell
                          key={key}
                          fill={barColors[index % barColors.length]}
                          stroke={index === activeIndex ? '#FFFFFF' : undefined}
                          strokeWidth={index === activeIndex ? 2 : 0}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartScrollBar>
        </div>
      </div>
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

const ChartScrollBar = styled(ScrollBar)`
  flex: 1;
  min-width: 0;
`;
