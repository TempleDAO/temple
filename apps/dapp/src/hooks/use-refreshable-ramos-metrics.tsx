import { useState } from 'react';
import useInterval from 'use-interval';

export type RamosMetrics = {
  templeBurned: number;
  templePriceUSD: number;
  templeVolume: number;
  timestamp: number;
  timeframe: number;
  totalProfitUSD: number;
  tpiLowerBoundUSD: number;
  treasuryPriceIndexUSD: number;
};

export default function useRefreshableRamosMetrics(intervalMinutes = 20) {
  const [hourlyMetrics, setHourlyMetrics] = useState<RamosMetrics[]>([]);

  const [dailyMetrics, setDailyMetrics] = useState<RamosMetrics[]>([]);

  async function refreshMetrics() {
    const hourlyRequest = await fetch('https://api.thegraph.com/subgraphs/name/templedao/templedao-ramos', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `{
            metricHourlySnapshots(orderDirection: desc, orderBy: timeframe, limit: 24) {
              templeBurned
              templePriceUSD
              templeVolume
              timestamp
              timeframe
              totalProfitUSD
              tpiLowerBoundUSD
              treasuryPriceIndexUSD
            }
          }`,
      }),
    });

    const dailyRequest = await fetch('https://api.thegraph.com/subgraphs/name/templedao/templedao-ramos', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `{
            metricDailySnapshots(orderDirection: desc, orderBy: timeframe, limit: 365) {
              templeBurned
              templePriceUSD
              templeVolume
              timestamp
              timeframe
              totalProfitUSD
              tpiLowerBoundUSD
              treasuryPriceIndexUSD
            }
          }`,
      }),
    });

    const [hourlyResult, dailyResult] = await Promise.all([hourlyRequest, dailyRequest]);

    const [hourlyMetrics, dailyMetrics] = await Promise.all([hourlyResult.json(), dailyResult.json()]);

    setHourlyMetrics(hourlyMetrics?.data?.metricHourlySnapshots ?? []);
    setDailyMetrics(dailyMetrics?.data?.metricDailySnapshots ?? []);
  }

  useInterval(refreshMetrics, intervalMinutes * 60 * 1000, true);

  return { dailyMetrics, hourlyMetrics };
}
