import { ChartSupportedTimeInterval } from 'utils/time-intervals';
import { useTheme } from 'styled-components';
import { format } from 'date-fns';
import { LineChart } from 'components/Charts';
import Loader from 'components/Loader/Loader';
import { formatTimestampedChartData } from 'utils/charts';
import useV2StrategySnapshotData, {
  StrategyTokenField,
  V2SnapshotMetric,
  V2StrategySnapshot,
} from '../hooks/use-dashboardv2-daily-snapshots';
import {
  ALL_STRATEGIES,
  DashboardData,
  isTRVDashboard,
} from '../DashboardConfig';

type XAxisTickFormatter = (timestamp: number) => string;

const tickFormatters: Record<ChartSupportedTimeInterval, XAxisTickFormatter> = {
  '1D': (timestamp) => format(timestamp, 'h aaa'),
  '1W': (timestamp) => format(timestamp, 'eee d LLL'),
  '1M': (timestamp) => format(timestamp, 'MMM d'),
  '1Y': (timestamp) => format(timestamp, 'MMM d y'),
};

const tooltipLabelFormatters: Record<
  ChartSupportedTimeInterval,
  XAxisTickFormatter
> = {
  ...tickFormatters,
  '1D': (timestamp) => format(timestamp, 'MMM do, h aaa'),
};

function transpose(
  data: V2StrategySnapshot[],
  metric: V2SnapshotMetric,
  format: MetricFormatter
) {
  // in sql this is roughly
  // select timeframe,
  //     max(totalValue) filter(where strategy.name = 'FooStrategy') as FooStrategy,
  //     max(totalValue) filter(where strategy.name = 'BarStrategy') as BarStrategy
  //     ...etc
  // from snapshots
  // group by timeframe;

  type Transposed = { [strategy: string]: number };
  const out = data.reduce((acc, row) => {
    // the timeframe is the UTC midnight for every snapshot
    // so we use it as the group by key
    const ix = row['timeframe'];
    const d = acc[ix] || ({} as Transposed);
    if (!d) {
      acc[ix] = d;
    }
    d[row['strategy']['name']] = format(row[metric]);
    acc[ix] = d;
    return acc;
  }, {} as { [timestamp: string]: Transposed });
  return Object.entries(out).map(([ts, values]) => ({
    timestamp: ts,
    ...values,
  }));
}

type MetricFormatter = (v: string) => number;

const parseNumericMetric = (v: string) => Math.round(parseFloat(v));

const metricFormatters: { [k in V2SnapshotMetric]: MetricFormatter } = {
  accruedInterestUSD: parseNumericMetric,
  benchmarkedEquityUSD: parseNumericMetric,
  creditUSD: parseNumericMetric,
  debtUSD: parseNumericMetric,
  netDebtUSD: parseNumericMetric,
  principalUSD: parseNumericMetric,
  totalMarketValueUSD: parseNumericMetric,
};

const numberFormatter = new Intl.NumberFormat('en', {
  maximumFractionDigits: 0,
  style: 'currency',
  currency: 'USD',
});

const V2StrategyMetricsChart: React.FC<{
  dashboardData: DashboardData;
  selectedMetric: V2SnapshotMetric;
  selectedInterval: ChartSupportedTimeInterval;
}> = ({ dashboardData, selectedMetric, selectedInterval }) => {
  // uncamel-case the metric names
  const formatMetricName = (name: string) => {
    // format only
    // - the selected metric
    // - all lines in TRV chart
    // - netDebt chart components
    // the remaining cases are individual debt tokens (sUSDe, sDAI, rsETH, ...)
    // which we keep as is
    if (
      name === selectedMetric ||
      isTRVDashboard(dashboardData.key) ||
      selectedMetric === 'netDebtUSD'
    ) {
      return (
        name
          // // insert a space before all caps
          .replace(/([A-Z][a-z])/g, ' $1')
          // // uppercase the first character
          .replace(/^./, (str) => str.toUpperCase())
          .replace(/USD$/, '')
      );
    }
    return name;
  };
  const tooltipValuesFormatter = (value: number, name: string) => [
    numberFormatter.format(value),
    formatMetricName(name),
  ];

  const formatV2StrategySnapshot = (m: V2StrategySnapshot) => {
    // whatever is returned from this is rendered in the chart
    const data = {
      [selectedMetric]: metricFormatters[selectedMetric](m[selectedMetric]),
      timestamp: m.timestamp,
    };

    // for netDebt we show extra metrics
    if (selectedMetric === 'netDebtUSD') {
      return {
        ...data,
        debtUSD: metricFormatters.debtUSD(m['debtUSD']),
        creditUSD: metricFormatters.creditUSD(m['creditUSD']),
      };
    }

    // augment the selected metric with the "split by asset" version
    // stored in the strategTokens array
    const selectedMetricToStrategyTokenMetric = new Map<
      V2SnapshotMetric,
      StrategyTokenField
    >([
      ['debtUSD', 'debtUSD'],
      ['creditUSD', 'creditUSD'],
      ['principalUSD', 'principalUSD'],
      ['accruedInterestUSD', 'accruedInterestUSD'],
      ['totalMarketValueUSD', 'marketValueUSD'],
    ]);

    const strategyTokenMetric =
      selectedMetricToStrategyTokenMetric.get(selectedMetric);

    if (strategyTokenMetric) {
      // toggle this for inverted Debt

      const strategyTokens = Object.fromEntries(
        m.strategyTokens.map((t) => [
          `${t.symbol}`,
          parseNumericMetric(t[strategyTokenMetric]),
        ])
      );
      return { ...data, ...strategyTokens };
    }
    return data;
  };

  const theme = useTheme();
  const formatMetric = metricFormatters[selectedMetric];

  const { dailyMetrics, hourlyMetrics, isLoadingOrError } =
    useV2StrategySnapshotData();

  // we need all strategies for the TRV dashboard anyway we can just as well reuse
  // what we have and filter client side

  // TRV dashboard shows all defined strategies as single lines
  // all other dashboards show just the selected strategy key
  const chartStrategyNames = isTRVDashboard(dashboardData.key)
    ? ALL_STRATEGIES
    : [dashboardData.key];

  const filteredDaily =
    dailyMetrics
      ?.filter((m) => chartStrategyNames.includes(m.strategy.name))
      .sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp)) ?? [];

  const filteredHourly =
    hourlyMetrics
      ?.filter((m) => chartStrategyNames.includes(m.strategy.name))
      .sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp)) ?? [];

  // if we are rendering chart for only one strategy we can use data as is
  // otherwise we have to transpose and show the selected metric for every strategy

  const transformedDaily =
    chartStrategyNames.length === 1
      ? filteredDaily.map(formatV2StrategySnapshot)
      : transpose(filteredDaily, selectedMetric, formatMetric);

  const transformedHourly =
    chartStrategyNames.length === 1
      ? filteredHourly.map(formatV2StrategySnapshot)
      : transpose(filteredHourly, selectedMetric, formatMetric);

  const formattedData = formatTimestampedChartData(
    transformedDaily,
    transformedHourly,
    (a) => ({
      ...a,
      timestamp:
        (typeof a.timestamp === 'string'
          ? parseInt(a.timestamp)
          : a.timestamp) * 1000,
    })
  );

  const xDataKey = 'timestamp';
  const colors = theme.palette.charts;

  if (formattedData[selectedInterval].length === 0 || isLoadingOrError) {
    return <Loader iconSize={48} />;
  }

  // infer available metrics from the data
  // cant look at first element only because strategyTokens
  // can can change during the lifetime of strategy
  const allKeys = new Set(
    formattedData[selectedInterval].flatMap((row) => Object.keys(row))
  );
  allKeys.delete(xDataKey);

  // sort to make color coding deterministic when switching interval/rerendering
  const metrics = [...allKeys].sort();

  // TRV renders selected metric of all strategies as multiline chart
  // other dashboards show the selected metric only (single line)
  const lines = isTRVDashboard(dashboardData.key)
    ? metrics.map((metric, ix) => ({
        series: metric,
        color: colors[ix % colors.length],
      }))
    : [{ series: selectedMetric, color: colors[0] }];

  // for non trv dashboard, pluck all other metrics
  // (individual assets that make up the metric)
  // to render as stacked area chart
  const stackedItems = !isTRVDashboard(dashboardData.key)
    ? // add +1 to skip the first color which is always the selectedMetric
      metrics
        .filter((m) => m !== selectedMetric)
        .map((metric, ix) => ({
          series: metric,
          color: colors[(ix + 1) % colors.length],
          stackId: 'a',
        }))
    : undefined;

  return (
    <LineChart
      chartData={formattedData[selectedInterval]}
      xDataKey={'timestamp'}
      lines={lines}
      stackedItems={stackedItems}
      xTickFormatter={tickFormatters[selectedInterval]}
      tooltipLabelFormatter={tooltipLabelFormatters[selectedInterval]}
      legendFormatter={formatMetricName}
      tooltipValuesFormatter={tooltipValuesFormatter}
    />
  );
};

export default V2StrategyMetricsChart;
