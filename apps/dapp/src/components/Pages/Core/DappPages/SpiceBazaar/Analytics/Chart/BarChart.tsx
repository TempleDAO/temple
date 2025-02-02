import type { DataKey, AxisDomain } from 'recharts/types/util/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTheme } from 'styled-components';
import { formatNumberAbbreviated } from 'utils/formatter';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';

type BarChartProps<T> = {
  chartData: T[];
  xDataKey: DataKey<keyof T>;
  xTickFormatter: (xValue: any, index: number) => string;
  yTickFormatter?: (yValue: any, index: number) => string;
  tooltipLabelFormatter: (value: any) => string;
  tooltipValuesFormatter?: (value: number, name: string) => string[];
  yDomain?: AxisDomain;
  series: { key: string; color: string }[];
};

export default function CustomBarChart<T>(
  props: React.PropsWithChildren<BarChartProps<T>>
) {
  const {
    chartData,
    xDataKey,
    xTickFormatter,
    yTickFormatter,
    tooltipLabelFormatter,
    tooltipValuesFormatter,
    yDomain,
    series,
  } = props;

  const theme = useTheme();
  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });

  return (
    <ResponsiveContainer minHeight={200} minWidth={320} height={250}>
      <BarChart
        data={chartData}
        margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
        barCategoryGap={20}
      >
        <XAxis
          axisLine={false}
          tickLine={false}
          dataKey={xDataKey}
          tickFormatter={xTickFormatter}
          tick={{ stroke: theme.palette.brandLight }}
          minTickGap={10}
          tickMargin={10}
          style={{
            fontFamily: 'Caviar Dreams',
            fontSize: '12px',
            fontWeight: '400',
            lineHeight: '18px',
            letterSpacing: '0.05em',
            fill: theme.palette.brandLight,
          }}
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
          tickMargin={16}
          style={{
            fontSize: '12px',
            fontWeight: '400',
            lineHeight: '18px',
            letterSpacing: '0.05em',
            fill: theme.palette.brandLight,
            fontFamily: 'Caviar Dreams',
          }}
          ticks={[0.0, 2.0, 4.0, 6.0]}
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
            />
          );
        })}
      </BarChart>
    </ResponsiveContainer>
  );
}
