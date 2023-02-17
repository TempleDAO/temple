import type { FC } from 'react';
import type { GetRAMOSMetricsResponse } from 'hooks/core/types';

import { format } from 'date-fns';
import { useRAMOSMetrics } from 'hooks/core/subgraph';
import { LineChart, Line, Tooltip, XAxis, YAxis } from 'recharts';
import { TIME_INTERVAL, DEFAULT_CHART_INTERVALS } from 'utils/time-intervals';

//TODO: cumulative temple burned and cumulative total profit USD

export const AnalyticsPage: FC = () => {
  const { isLoading, response, error } = useRAMOSMetrics();

  if (error) {
    return <div>Error fetching data</div>;
  }

  if (isLoading || !response) {
    return <div>Loading</div>;
  }

  const chartData = prepareChartData(response);

  return (
    <>
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
    return [];
  }

  return data.map((metrics) => ({
    timestamp: parseInt(metrics.timestamp) * 1000,
    templeBurned: parseFloat(metrics.templeBurned),
    totalProfitUSD: parseFloat(metrics.totalProfitUSD),
  }));
}
