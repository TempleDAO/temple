import { LabeledTimeIntervals, TIME_INTERVAL } from 'utils/time-intervals';
import type { AxisDomain } from 'recharts/types/util/types';
import { useEffect, useState } from 'react';
import styled, { useTheme } from 'styled-components';
import { format } from 'date-fns';
import { LineChart } from 'components/Charts';
import Loader from 'components/Loader/Loader';
import {
  formatNumberAbbreviated,
  formatNumberFixedDecimals,
} from 'utils/formatter';
import { formatDailyDataPoints } from 'utils/charts';
import { fetchGenericSubgraph } from 'utils/subgraph';
import IntervalToggler from 'components/Charts/IntervalToggler';
import env from 'constants/env';

type XAxisTickFormatter = (timestamp: number) => string;

type ChartIntervals = '1W' | '1M' | '1Y';
const CHART_INTERVALS: LabeledTimeIntervals = [
  { interval: TIME_INTERVAL.ONE_WEEK, label: '1W' },
  { interval: TIME_INTERVAL.ONE_MONTH, label: '1M' },
  { interval: TIME_INTERVAL.ONE_YEAR, label: '1Y' },
] as const;

const tickFormatters: Record<ChartIntervals, XAxisTickFormatter> = {
  '1W': (timestamp) => format(timestamp, 'eee d LLL'),
  '1M': (timestamp) => format(timestamp, 'MMM do'),
  '1Y': (timestamp) => format(timestamp, 'MMM do y'),
};

const tooltipLabelFormatters: Record<ChartIntervals, XAxisTickFormatter> = {
  ...tickFormatters,
};

type Metric = { timestamp: number; utilRatio: number; interestYield: number };

const tooltipValuesFormatter = (value: number, name: string) => [
  `${formatNumberFixedDecimals(value, 4).toString()}%`,
  name,
];

const yDomain: AxisDomain = [0, 100];

export const TlcChart = () => {
  const [selectedInterval, setSelectedInterval] =
    useState<ChartIntervals>('1M');
  const theme = useTheme();
  const [metrics, setMetrics] = useState<Metric[]>();

  useEffect(() => {
    const fetchMetrics = async () => {
      const { data } = await fetchGenericSubgraph<any>(
        env.subgraph.templeV2,
        `{
            tlcDailySnapshots(orderBy: timestamp, orderDirection: desc) {
              timestamp
              utilRatio
              interestYield
            }
          }`
      );
      setMetrics(data.tlcDailySnapshots);
    };
    fetchMetrics();
  }, []);

  if (!metrics) return <Loader />;

  const formattedData = formatDailyDataPoints(
    metrics,
    CHART_INTERVALS,
    new Date().getTime(),
    (metric) => ({
      timestamp: metric.timestamp * 1000,
      utilRatio: metric.utilRatio * 100,
      interestYield: metric.interestYield * 100,
    })
  );

  return (
    <>
      <IntervalPosition>
        <IntervalToggler
          selectedInterval={selectedInterval}
          setSelectedInterval={setSelectedInterval as any}
          intervals={CHART_INTERVALS}
        />
      </IntervalPosition>
      {
        <LineChart
          chartData={formattedData[selectedInterval].reverse()}
          xDataKey="timestamp"
          lines={[
            { series: 'interestYield', color: theme.palette.brand },
            { series: 'utilRatio', color: theme.palette.light },
          ]}
          xTickFormatter={tickFormatters[selectedInterval]}
          yTickFormatter={(val, i) =>
            formatNumberAbbreviated(val).number.toFixed(2) + '%'
          }
          tooltipLabelFormatter={tooltipLabelFormatters[selectedInterval]}
          yDomain={yDomain}
          legendFormatter={(name) =>
            name === 'utilRatio' ? 'Utilization Rate' : 'Interest Rate'
          }
          tooltipValuesFormatter={(value, name) =>
            tooltipValuesFormatter(
              value,
              name === 'utilRatio' ? 'Utilization Rate' : 'Interest Rate'
            )
          }
        />
      }
    </>
  );
};

const IntervalPosition = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
`;
