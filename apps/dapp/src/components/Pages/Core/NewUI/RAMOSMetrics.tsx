import type { FC } from 'react';
import type { RAMOSMetric } from 'hooks/core/types';
import type { ChartSupportedTimeInterval } from 'utils/time-intervals';

import styled, { useTheme } from 'styled-components';
import { format, differenceInDays } from 'date-fns';
import { BiAxialAreaChart } from 'components/Charts';
import { useRAMOSMetrics } from 'hooks/core/subgraph';
import { formatTimestampedChartData } from 'utils/charts';
import { formatNumberAbbreviated, formatNumberWithCommas } from 'utils/formatter';
import * as breakpoints from 'styles/breakpoints';

type XAxisTickFormatter = (timestamp: number) => string;

const RAMOS_LAUNCH_DATE = new Date(1671058907000);

const tooltipLabelFormatters: Record<ChartSupportedTimeInterval, XAxisTickFormatter> = {
  '1D': (timestamp) =>
    `Day ${differenceInDays(timestamp, RAMOS_LAUNCH_DATE).toString()}, ${format(timestamp, 'h aaa')}`,
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

const CHART_INTERVAL: ChartSupportedTimeInterval = '1Y';

export const RAMOSMetrics: FC = () => {
  const { dailyMetrics, hourlyMetrics, isLoading, errors } = useRAMOSMetrics();
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

  const chartData = formattedData[CHART_INTERVAL].reverse();

  return (
    <>
      <MetricsBadgeRow>
        <LatestMetricValue>
          <h3>Days since launch</h3>
          <p>{latestValues.daysSinceLaunch}</p>
        </LatestMetricValue>
        <LatestMetricValue>
          <h3>Temple burned</h3>
          <p>{formatNumberAbbreviated(latestValues.templeBurned).string}</p>
        </LatestMetricValue>
      </MetricsBadgeRow>
      <ChartTitle>Overlay of Temple Burned and Value Accrual</ChartTitle>
      <ChartContainer>
        <BiAxialAreaChart
          chartData={chartData}
          xDataKey={'timestamp'}
          xLabel="Days since launch"
          lines={[
            { series: 'templeBurned', color: theme.palette.brand, yAxisId: 'left' },
            { series: 'totalProfitUSD', color: theme.palette.light, yAxisId: 'right' },
          ]}
          xTickFormatter={xTickFormatter}
          tooltipLabelFormatter={tooltipLabelFormatters[CHART_INTERVAL]}
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

  h3 {
    margin: 0;
    padding-bottom: 1.5rem;
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

const ChartTitle = styled.h3`
  margin: 0;
`;
