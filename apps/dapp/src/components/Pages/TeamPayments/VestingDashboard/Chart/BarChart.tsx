import type { DataKey, AxisDomain } from 'recharts/types/util/types';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Line,
} from 'recharts';
import { useTheme } from 'styled-components';

export type BarChartProps<T> = {
  chartData: T[];
  xDataKey: DataKey<keyof T>;
  xTickFormatter: (xValue: any, index: number) => string;
  yTickFormatter?: (yValue: any, index: number) => string;
  tooltipLabelFormatter: (value: any) => string;
  tooltipValuesFormatter?: (props: any) => string[];
  yDomain?: AxisDomain;
  series: { key: string; color: string }[];
  lineDataKey?: DataKey<T>;
};

export default function CustomBarChart<T>({
  chartData,
  xDataKey,
  xTickFormatter,
  yTickFormatter,
  tooltipLabelFormatter,
  tooltipValuesFormatter,
  yDomain,
  series,
  lineDataKey,
}: React.PropsWithChildren<BarChartProps<T>>) {
  const theme = useTheme();

  const activeBarStyle = {
    fill: series[series.length - 1].color,
    stroke: '#FFFFFF',
    strokeWidth: 1,
  };

  const CustomTooltip = ({ payload }: any) => {
    if (!tooltipValuesFormatter || !payload || payload.length === 0)
      return null;

    const rawData = payload[0]?.payload;
    if (!rawData) return null;

    const lines = tooltipValuesFormatter(rawData);

    return (
      <div
        style={{
          background: 'linear-gradient(180deg, #353535 45.25%, #101010 87.55%)',
          boxShadow: '3px 6px 5.5px 0px #00000080',
          borderRadius: '15px',
          padding: '12px 16px',
          minWidth: '180px',
          color: theme.palette.brandLight,
          fontSize: '12px',
          lineHeight: '18px',
          whiteSpace: 'pre-line',
        }}
      >
        <div
          style={{
            color: theme.palette.brand,
            fontSize: '14px',
            lineHeight: '21px',
            marginBottom: '6px',
          }}
        >
          {tooltipLabelFormatter('')}
        </div>
        {lines.map((line, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={i}>{line}</div>
        ))}
      </div>
    );
  };

  return (
    <ResponsiveContainer minHeight={200} minWidth={320} height={280}>
      <ComposedChart
        data={chartData}
        margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
        barCategoryGap={15}
      >
        <CartesianGrid
          vertical={false}
          stroke={theme.palette.brandDarker}
          strokeDasharray="0"
          strokeWidth={1}
        />
        <XAxis
          axisLine={false}
          tickLine={false}
          dataKey={xDataKey}
          tickFormatter={xTickFormatter}
          tick={{ stroke: theme.palette.brandLight }}
          minTickGap={0}
          tickMargin={10}
          style={{
            fontFamily: 'Caviar Dreams',
            fontSize: '12px',
            fontWeight: '400',
            fill: theme.palette.brandLight,
          }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tickFormatter={yTickFormatter}
          tick={{ stroke: theme.palette.brandLight }}
          domain={yDomain}
          tickMargin={16}
          style={{
            fontFamily: 'Caviar Dreams',
            fontSize: '12px',
            fontWeight: '400',
            fill: theme.palette.brandLight,
          }}
          ticks={[0, 500_000, 1_000_000, 1_500_000]}
        />
        <Tooltip content={<CustomTooltip />} offset={30} cursor={false} />
        {series.map((serie, index) => {
          const isTopBar = index === series.length - 1;
          const isBottomBar = index === 0;
          return (
            <Bar
              key={serie.key}
              dataKey={serie.key}
              stackId="a"
              fill={serie.color}
              radius={
                isTopBar
                  ? [5, 5, 0, 0]
                  : isBottomBar
                  ? [0, 0, 5, 5]
                  : [0, 0, 0, 0]
              }
              {...(isTopBar && { activeBar: activeBarStyle })}
            />
          );
        })}
        {lineDataKey && (
          <Line
            type="linear"
            dataKey={lineDataKey}
            stroke={theme.palette.brandLight}
            strokeDasharray="4 4"
            strokeWidth={2}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
