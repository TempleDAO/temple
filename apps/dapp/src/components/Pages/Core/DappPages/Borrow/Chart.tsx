import { DEFAULT_CHART_INTERVALS, ChartSupportedTimeIntervalNoDaily } from 'utils/time-intervals';
import type { AxisDomain } from 'recharts/types/util/types';
import { useEffect, useState } from 'react';
import { useTheme } from 'styled-components';
import { format } from 'date-fns';
import { LineChart } from 'components/Charts';
import Loader from 'components/Loader/Loader';
import { formatNumberAbbreviated, formatNumberFixedDecimals } from 'utils/formatter';
import { formatDailyDataPoints } from 'utils/charts';
import { fetchGenericSubgraph } from 'utils/subgraph';
import { IntervalTogglerExcludeDaily } from 'components/Charts/IntervalToggler';

type XAxisTickFormatter = (timestamp: number) => string;

const tickFormatters: Record<ChartSupportedTimeIntervalNoDaily, XAxisTickFormatter> = {
  '1W': (timestamp) => format(timestamp, 'eee d LLL'),
  '1M': (timestamp) => format(timestamp, 'MMM do'),
  '1Y': (timestamp) => format(timestamp, 'MMM do y'),
};

const tooltipLabelFormatters: Record<ChartSupportedTimeIntervalNoDaily, XAxisTickFormatter> = {
  ...tickFormatters,
};

type Metric = { timestamp: number; utilRatio: number; interestRate: number };

const tooltipValuesFormatter = (value: number, name: string) => [
  `${formatNumberFixedDecimals(value, 4).toString()}%`,
  name,
];

const yDomain: AxisDomain = ([dataMin, dataMax]) => [dataMin * 0.5, Number((dataMax * 1.5).toFixed(2))];

export const TemplePriceChart = () => {
  const [selectedInterval, setSelectedInterval] = useState<ChartSupportedTimeIntervalNoDaily>('1M');
  const theme = useTheme();
  const [metrics, setMetrics] = useState<Metric[]>();

  useEffect(() => {
    const fetchMetrics = async () => {
      const { data } = await fetchGenericSubgraph(
        'https://api.thegraph.com/subgraphs/name/medariox/v2-mainnet',
        `{
            tlcdailySnapshots(orderBy: timestamp, orderDirection: desc) {
              timestamp
              utilRatio
              interestRate
            }
          }`
      );
      setMetrics(data.tlcdailySnapshots);
    };
    fetchMetrics();
  }, []);

  if (!metrics) return <Loader />;

  const formattedData = formatDailyDataPoints(metrics, DEFAULT_CHART_INTERVALS, new Date().getTime(), (metric) => ({
    timestamp: metric.timestamp * 1000,
    utilRatio: metric.utilRatio * 100,
    interestRate: metric.interestRate * 100,
  }));

  return (
    <>
      <IntervalTogglerExcludeDaily selectedInterval={selectedInterval} setSelectedInterval={setSelectedInterval} />
      {
        <LineChart
          chartData={formattedData[selectedInterval].reverse()}
          xDataKey="timestamp"
          lines={[
            { series: 'interestRate', color: theme.palette.brand },
            { series: 'utilRatio', color: theme.palette.light },
          ]}
          xTickFormatter={tickFormatters[selectedInterval]}
          yTickFormatter={(val, i) => formatNumberAbbreviated(val).string + '%'}
          tooltipLabelFormatter={tooltipLabelFormatters[selectedInterval]}
          yDomain={yDomain}
          legendFormatter={(name) => (name === 'utilRatio' ? 'Utilization Rate' : 'Interest Rate')}
          tooltipValuesFormatter={(value, name) =>
            tooltipValuesFormatter(value, name === 'utilRatio' ? 'Utilization Rate' : 'Interest Rate')
          }
        />
      }
    </>
  );
};
