import { useState } from 'react';
import useInterval from 'use-interval';

export type PriceMetrics = {
  timestamp: number;
  intrinsicValue: number;
  templePrice: string;
  thresholdTemplePrice: number;
};

export default function useRefreshablePriceMetrics(intervalMinutes = 20) {
  const [hourlyPriceMetrics, setHourlyPriceMetrics] = useState<PriceMetrics[]>(
    []
  );

  const [dailyPriceMetrics, setDailyPriceMetrics] = useState<PriceMetrics[]>(
    []
  );

  async function refreshMetrics() {
    const hourlyRequest = await fetch(
      'https://api.thegraph.com/subgraphs/name/medariox/temple-balances',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `{
            protocolMetrics(orderDirection: desc, orderBy: timestamp) {
              timestamp
              intrinsicValue
              templePrice
              thresholdTemplePrice
            }
          }`,
        }),
      }
    );

    const dailyRequest = await fetch(
      'https://api.thegraph.com/subgraphs/name/medariox/temple-balances',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `{
            dayProtocolMetrics(orderDirection: desc, orderBy: timestamp) {
              timestamp
              intrinsicValue
              templePrice
              thresholdTemplePrice
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

    setHourlyPriceMetrics(hourlyMetrics?.data?.protocolMetrics ?? []);
    setDailyPriceMetrics(dailyMetrics?.data?.dayProtocolMetrics ?? []);
  }

  useInterval(refreshMetrics, intervalMinutes * 60 * 1000, true);

  return { dailyPriceMetrics, hourlyPriceMetrics };
}
