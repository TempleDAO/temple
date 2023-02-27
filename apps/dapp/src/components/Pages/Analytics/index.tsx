import type { FC } from 'react';
import type { RAMOSMetric } from 'hooks/core/types';
import type { ChartSupportedTimeInterval } from 'utils/time-intervals';

import { useState } from 'react';
import styled, { useTheme } from 'styled-components';
import { format, differenceInDays } from 'date-fns';
import { BiAxialLineChart, IntervalToggler } from 'components/Charts';
import { useRAMOSMetrics } from 'hooks/core/subgraph';
import { formatTimestampedChartData } from 'utils/charts';
import { formatNumberAbbreviated, formatNumberWithCommas } from 'utils/formatter';
import * as breakpoints from 'styles/breakpoints';

type XAxisTickFormatter = (timestamp: number) => string;

const RAMOS_LAUNCH_DATE = new Date(1671058907000);

const tooltipLabelFormatters: Record<ChartSupportedTimeInterval, XAxisTickFormatter> = {
  '1D': (timestamp) => format(timestamp, 'H aaa'),
  '1W': (timestamp) => `Day ${differenceInDays(timestamp, RAMOS_LAUNCH_DATE).toString()}`,
  '1M': (timestamp) => `Day ${differenceInDays(timestamp, RAMOS_LAUNCH_DATE).toString()}`,
  '1Y': (timestamp) => `Day ${differenceInDays(timestamp, RAMOS_LAUNCH_DATE).toString()}`,
};

const tooltipValuesFormatter = (value: number, name: string) => [formatNumberWithCommas(value), name];

const tooltipValueNames = {
  templeBurned: 'Temple burned',
  totalProfitUSD: 'Value accrual to holders (USD)',
};

const xTickFormatter = (value: number, _index: number) =>
  `  ${differenceInDays(value, RAMOS_LAUNCH_DATE).toString()}  `;

//TODO: Create components to handle error cases

export const AnalyticsPage: FC = () => {
  const { dailyMetrics, hourlyMetrics, isLoading, errors } = useRAMOSMetrics();
  const [selectedInterval, setSelectedInterval] = useState<ChartSupportedTimeInterval>('1M');
  const theme = useTheme();

  if (errors.some(Boolean)) {
    return <div>Error fetching data</div>;
  }

  if (isLoading) {
    return <div>Loading</div>;
  }

  if (dailyMetrics === null || hourlyMetrics === null) {
    return <div>Invalid subgraph response</div>;
  }

  if (dailyMetrics.data === undefined || hourlyMetrics.data === undefined) {
    return <div>Empty payload</div>;
  }

  const formattedData = formatTimestampedChartData(
    dailyMetrics.data.metricDailySnapshots,
    hourlyMetrics.data.metricHourlySnapshots,
    formatDataPoint
  );

  if (formattedData === null) {
    return <div>Empty payload</div>;
  }

  const latestValues = {
    templeBurned: formattedData['1D'][0].templeBurned,
    totalProfitUSD: formattedData['1D'][0].totalProfitUSD,
    daysSinceLaunch: differenceInDays(new Date(), RAMOS_LAUNCH_DATE),
  };

  const chartData = formattedData[selectedInterval].reverse();

  return (
    <>
      <h1>RAMOS Analytics</h1>
      <MetricsBadgeRow>
        <LatestMetricValue>
          <h2>Days since launch</h2>
          <p>{latestValues.daysSinceLaunch}</p>
        </LatestMetricValue>
        <LatestMetricValue>
          <h2>Temple burned</h2>
          <p>{formatNumberAbbreviated(latestValues.templeBurned)}</p>
        </LatestMetricValue>
      </MetricsBadgeRow>
      <IntervalToggler selectedInterval={selectedInterval} setSelectedInterval={setSelectedInterval} />
      <ChartTitle>Overlay of Temple Burned and Value Accrual</ChartTitle>
      <ChartContainer>
        <BiAxialLineChart
          chartData={chartData}
          xDataKey={'timestamp'}
          xLabel="Days since launch"
          lines={[
            { series: 'templeBurned', color: theme.palette.brand, yAxisId: 'left' },
            { series: 'totalProfitUSD', color: theme.palette.light, yAxisId: 'right' },
          ]}
          xTickFormatter={xTickFormatter}
          tooltipLabelFormatter={tooltipLabelFormatters[selectedInterval]}
          tooltipValuesFormatter={(value, name) =>
            tooltipValuesFormatter(
              value,
              name === 'templeBurned' ? tooltipValueNames.templeBurned : tooltipValueNames.totalProfitUSD
            )
          }
          legendFormatter={(name) =>
            name === 'templeBurned' ? tooltipValueNames.templeBurned : tooltipValueNames.totalProfitUSD
          }
        />
      </ChartContainer>
    </>
  );
};

function formatDataPoint(metric: RAMOSMetric) {
  return {
    timestamp: parseInt(metric.timestamp) * 1000,
    templeBurned: parseFloat(metric.templeBurned),
    totalProfitUSD: parseFloat(metric.totalProfitUSD),
  };
}

const MetricsBadgeRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 30px;
  padding-bottom: 50px;

  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
  `)}
`;

const LatestMetricValue = styled.article`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  h2 {
    margin: 0;
    font-size: 1rem;
  }

  p {
    margin: 0;
    font-size: 3rem;
    font-weight: bold;
    color: ${({ theme }) => theme.palette.brandLight};
  }
`;

const ChartContainer = styled.div`
  padding: 20px;
`;

const ChartTitle = styled.h2`
  margin: 0;
`;
