import type { FC, MouseEventHandler } from 'react';
import type { GetRAMOSDailyMetricsResponse, GetRAMOSHourlyMetricsResponse } from 'hooks/core/types';
import type { RAMOSMetric } from 'hooks/core/types';
import type { LabeledTimeIntervals, ChartSupportedTimeInterval } from 'utils/time-intervals';

import { useState } from 'react';
import styled, { useTheme } from 'styled-components';
import { format } from 'date-fns';
import { LineChart } from './LineChart';
import { useRAMOSMetrics } from 'hooks/core/subgraph';
import { DEFAULT_CHART_INTERVALS } from 'utils/time-intervals';
import { formatNumberAbbreviated } from 'utils/formatter';

type FormattedDataPoint = {
  timestamp: number;
  templeBurned: number;
  totalProfitUSD: number;
};

type PreparedData = Record<ChartSupportedTimeInterval, FormattedDataPoint[]>;

type XAxisTickFormatter = (timestamp: number) => string;

const tickFormatters: Record<ChartSupportedTimeInterval, XAxisTickFormatter> = {
  '1D': (timestamp) => format(timestamp, 'H aaa'),
  '1W': (timestamp) => format(timestamp, 'eee d LLL'),
  '1M': (timestamp) => format(timestamp, 'MMM do'),
  '1Y': (timestamp) => format(timestamp, 'MMM do y'),
};

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

  const preparedData = prepareChartData(dailyMetrics, hourlyMetrics);

  if (preparedData === null) {
    return <div>Empty payload</div>;
  }

  const chartData = preparedData[selectedInterval];

  return (
    <>
      <TogglerRow>
        <TogglerContainer>
          {DEFAULT_CHART_INTERVALS.map(({ label }) => (
            <Toggle key={label} onClick={() => setSelectedInterval(label)} selected={label === selectedInterval}>
              {label}
            </Toggle>
          ))}
        </TogglerContainer>
      </TogglerRow>
      <h1>Temple Burned</h1>
      <LineChart
        chartData={chartData}
        xDataKey={'timestamp'}
        yDataKey={'templeBurned'}
        xTickFormatter={tickFormatters[selectedInterval]}
      />
      <h1>Total Profit USD</h1>
      <LineChart
        chartData={chartData}
        xDataKey={'timestamp'}
        yDataKey={'totalProfitUSD'}
        xTickFormatter={tickFormatters[selectedInterval]}
      />
    </>
  );
};

function prepareChartData(dailyMetrics: GetRAMOSDailyMetricsResponse, hourlyMetrics: GetRAMOSHourlyMetricsResponse) {
  const dailyData = dailyMetrics.data?.metricDailySnapshots;
  const hourlyData = hourlyMetrics.data?.metricHourlySnapshots;

  if (!dailyData) {
    console.warn('Missing response data for RAMOS daily metrics');
    return null;
  }

  const now = new Date().getTime();

  const preparedDailyData = filterByTimeIntervals(dailyData, DEFAULT_CHART_INTERVALS, now);

  if (!hourlyData) {
    console.warn('Missing response data for RAMOS hourly metrics');
    return preparedDailyData;
  }

  const preparedHourlyData = hourlyData.map((metric) => getDataPoint(metric, now));

  return {
    ...preparedDailyData,
    '1D': preparedHourlyData,
  };
}

function filterByTimeIntervals(data: RAMOSMetric[], timeIntervals: LabeledTimeIntervals, now: number) {
  const metricsByIntervalAccumulator: PreparedData = {
    '1D': [],
    '1W': [],
    '1M': [],
    '1Y': [],
  };

  const sortedTimeIntervals = timeIntervals.map((interval) => interval).sort((a, b) => a.interval - b.interval);

  return data.reduce((acc, metric) => {
    const formattedDataPoint = getDataPoint(metric, now);

    const biggestIntervalMatchIndex = sortedTimeIntervals.findIndex((labeledInterval) =>
      formattedDataPoint.isWithinTimeIntervalOf(labeledInterval.interval)
    );

    if (biggestIntervalMatchIndex === -1) {
      return acc;
    }

    for (
      let timeIntervalIndex = biggestIntervalMatchIndex;
      timeIntervalIndex < sortedTimeIntervals.length;
      timeIntervalIndex++
    ) {
      const key = sortedTimeIntervals[timeIntervalIndex].label;

      acc[key].push(formattedDataPoint);
    }

    return acc;
  }, metricsByIntervalAccumulator);
}

function getDataPoint(metric: RAMOSMetric, now: number) {
  return {
    timestamp: parseInt(metric.timestamp) * 1000,
    templeBurned: parseFloat(metric.templeBurned),
    totalProfitUSD: parseFloat(metric.totalProfitUSD),
    isWithinTimeIntervalOf(threshold: number) {
      return now - this.timestamp <= threshold;
    },
  };
}

const TogglerRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: 1.25rem;
  width: 90%;
`;

const TogglerContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 1.25rem;
  font-size: 0.7rem;
`;

type ToggleProps = {
  selected?: boolean;
  onClick: MouseEventHandler;
};

const Toggle = styled.span<ToggleProps>`
  display: inline-block;
  user-select: none;
  cursor: pointer;
  color: ${({ selected, theme }) => (selected ? theme.palette.brandLight : theme.palette.brand)};
  &:hover {
    color: white;
  }
  font-size: 1rem;
  font-weight: ${({ selected }) => (selected ? 'bold' : '')};
`;
