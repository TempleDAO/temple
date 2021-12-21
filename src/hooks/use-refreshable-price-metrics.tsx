import { useEffect, useState } from 'react';
import useInterval from 'use-interval';

type PriceMetrics = {
  templePrice: string;
  timestamp: number;
  treasuryStables: number;
  templeSupply: number;
};

export default function useRefreshablePriceMetrics(
  intervalMinutes = 10
): PriceMetrics[] {
  const [priceMetrics, setPriceMetrics] = useState<PriceMetrics[]>([]);

  async function refreshMetrics() {
    const result = await fetch(
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
              templeSupply
              templePrice
              treasuryStables
            }
          }`,
        }),
      }
    );

    const metrics = await result.json();
    setPriceMetrics(metrics?.data?.protocolMetrics ?? []);
  }

  useInterval(refreshMetrics, intervalMinutes * 60 * 1000, true);

  return priceMetrics;
}
