import { useState } from 'react';
import useInterval from 'use-interval';
import env from 'constants/env';

export type ProtocolMetrics = {
  templeBurned: string;
  templePrice: string;
  timeframe: number;
  timestamp: number;
  totalProfitUSD: string;
  treasuryPriceIndex: string;
};

export default function useRefreshableProtocolMetrics(intervalMinutes = 20) {
  const [hourlyMetrics, setHourlyMetrics] = useState<ProtocolMetrics[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<ProtocolMetrics[]>([]);

  async function refreshMetrics() {
    const hourlyRequest = await fetch(env.subgraph.protocolMetrics, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `{
            metricHourlySnapshots(orderDirection: desc, orderBy: timeframe, first: 24) {
              templeBurned
              templePrice
              timeframe
              timestamp
              totalProfitUSD
              treasuryPriceIndex
            }
          }`,
      }),
    });

    const dailyRequest = await fetch(env.subgraph.protocolMetrics, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `{
            metricDailySnapshots(orderDirection: desc, orderBy: timeframe, first: 365) {
              templeBurned
              templePrice
              timeframe
              timestamp
              totalProfitUSD
              treasuryPriceIndex
            }
          }`,
      }),
    });

    const [hourlyResult, dailyResult] = await Promise.all([
      hourlyRequest,
      dailyRequest,
    ]);
    const [hourlyMetrics, dailyMetrics] = await Promise.all([
      hourlyResult.json(),
      dailyResult.json(),
    ]);

    setHourlyMetrics(hourlyMetrics?.data?.metricHourlySnapshots ?? []);
    setDailyMetrics(dailyMetrics?.data?.metricDailySnapshots ?? []);
  }

  useInterval(refreshMetrics, intervalMinutes * 60 * 1000, true);

  return { dailyMetrics, hourlyMetrics };
}
