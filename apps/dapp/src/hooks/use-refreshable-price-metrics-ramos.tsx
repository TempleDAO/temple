import { useState } from 'react';
import useInterval from 'use-interval';

export type PriceMetricsRamos = {
  tpiLowerBoundUSD: number;
  timestamp: number;
  timeframe: number;
  templePriceUSD: number;
  treasuryPriceIndexUSD: number;
};

export default function useRefreshablePriceMetricsRamos(intervalMinutes = 20) {
  const [hourlyPriceMetrics, setHourlyPriceMetrics] = useState<PriceMetricsRamos[]>(
    []
  );

  const [dailyPriceMetrics, setDailyPriceMetrics] = useState<PriceMetricsRamos[]>(
    []
  );

  async function refreshMetrics() {
    const hourlyRequest = await fetch(
      'https://api.thegraph.com/subgraphs/name/medariox/temple-ramos',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `{
            metricHourlySnapshots(orderDirection: desc, orderBy: timeframe) {
              tpiLowerBoundUSD
              timestamp
              timeframe
              templePriceUSD
              treasuryPriceIndexUSD
            }
          }`,
        }),
      }
    );

    const dailyRequest = await fetch(
      'https://api.thegraph.com/subgraphs/name/medariox/temple-ramos',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `{
            metricDailySnapshots(orderDirection: desc, orderBy: timeframe) {
              tpiLowerBoundUSD
              timestamp
              timeframe
              templePriceUSD
              treasuryPriceIndexUSD
            }
          }`,
        }),
      }
    );

    const [hourlyResult, dailyResult] = await Promise.all([
      hourlyRequest,
      dailyRequest,
    ]);

    const [hourlyMetrics, dailyMetrics] = await Promise.all([
      hourlyResult.json(),
      dailyResult.json(),
    ]);

    setHourlyPriceMetrics(hourlyMetrics?.data?.metricHourlySnapshots ?? []);
    setDailyPriceMetrics(dailyMetrics?.data?.metricDailySnapshots ?? []);
  }

  useInterval(refreshMetrics, intervalMinutes * 60 * 1000, true);

  return { dailyPriceMetrics, hourlyPriceMetrics };
}
