import type { FC } from 'react';
import type { GetRAMOSMetricsResponse } from 'hooks/core/types';
import type { RAMOSMetric } from 'hooks/core/types';
import type { LabeledTimeIntervals, ChartSupportedTimeInterval } from 'utils/time-intervals';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useRAMOSMetrics } from 'hooks/core/subgraph';
import { LineChart, Line, Tooltip, XAxis, YAxis } from 'recharts';
import { DEFAULT_CHART_INTERVALS } from 'utils/time-intervals';

type FormattedDataPoint = {
  timestamp: number;
  templeBurned: number;
  totalProfitUSD: number;
};

type PreparedData = Record<ChartSupportedTimeInterval, FormattedDataPoint[]>;

//TODO: Create components to handle error cases

export const AnalyticsPage: FC = () => {
  const { isLoading, response, error } = useRAMOSMetrics();
  const [preparedData, setPreparedData] = useState<PreparedData | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<ChartSupportedTimeInterval>('1Y');

  useEffect(() => {
    if (response) {
      setPreparedData(prepareChartData(response));
    }
  }, [response]);

  if (error) {
    return <div>Error fetching data</div>;
  }

  if (isLoading || !response) {
    return <div>Loading</div>;
  }

  if (preparedData === null) {
    return <div>Empty payload</div>;
  }

  const chartData = preparedData[selectedInterval];

  return (
    <>
      <div>
        <p onClick={() => setSelectedInterval('1D')}>1D</p>
        <p onClick={() => setSelectedInterval('1W')}>1W</p>
        <p onClick={() => setSelectedInterval('1M')}>1M</p>
        <p onClick={() => setSelectedInterval('1Y')}>1Y</p>
      </div>
      <h1>Temple Burned</h1>
      <div>
        <LineChart width={600} height={300} data={chartData}>
          <Line type="monotone" dataKey="templeBurned" stroke="#239966" dot={false} />
          <XAxis dataKey="timestamp" scale="time" tickFormatter={(timestamp) => format(timestamp, 'PP')} />
          <YAxis />
          <Tooltip />
        </LineChart>
      </div>
      <h1>Total Profit USD</h1>
      <div>
        <LineChart width={600} height={300} data={chartData}>
          <Line type="monotone" dataKey="totalProfitUSD" stroke="#5566d8" dot={false} />
          <XAxis dataKey="timestamp" scale="time" tickFormatter={(timestamp) => format(timestamp, 'PP')} />
          <YAxis />
          <Tooltip />
        </LineChart>
      </div>
    </>
  );
};

function prepareChartData(response: GetRAMOSMetricsResponse) {
  const data = response.data?.metricDailySnapshots;

  if (!data) {
    console.warn('No data to show for RAMOS metrics');
    return null;
  }

  return filterByTimeIntervals(data, DEFAULT_CHART_INTERVALS);
}

function filterByTimeIntervals(data: RAMOSMetric[], timeIntervals: LabeledTimeIntervals) {
  const metricsByIntervalAccumulator: PreparedData = {
    '1D': [],
    '1W': [],
    '1M': [],
    '1Y': [],
  };

  const sortedTimeIntervals = timeIntervals.map((interval) => interval).sort((a, b) => a.interval - b.interval);

  const now = new Date().getTime();

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
