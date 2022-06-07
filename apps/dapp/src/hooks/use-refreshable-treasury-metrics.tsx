import { useEffect, useState } from 'react';
import useInterval from 'use-interval';
import { TreasuryMetrics } from 'services/MetricsService';
import { fetchSubgraph } from 'utils/subgraph';

export default function useRefreshableTreasuryMetrics() {
  const [treasuryMetrics, setTreasuryMetrics] =
    useState<TreasuryMetrics | null>(null);

  async function getTreasuryMetrics(): Promise<TreasuryMetrics> {
    const response = await fetchSubgraph(
      `{
          protocolMetrics(first: 1, orderBy: timestamp, orderDirection: desc) {
            lockedStables
            epochPercentageYield
            templePrice
          }
        }`
    );

    const data = response?.data?.protocolMetrics?.[0] || {};

    const epy = parseFloat(data.epochPercentageYield);
    const templeApy = Math.round((Math.pow(epy + 1, 365.25) - 1) * 100);
    const templePrice = parseFloat(data.templePrice);
    const lockedStables = parseFloat(data.lockedStables);

    return {
      templeValue: templePrice,
      templeApy,
      treasuryValue: lockedStables,
    };
  }

  async function refreshMetrics() {
    try {
      const treasuryMetrics = await getTreasuryMetrics();
      setTreasuryMetrics(treasuryMetrics);
    } catch (error) {
      console.info(error);
    }
  }

  const clearInterval = useInterval(refreshMetrics, 5 * 60 * 1000, true);

  // clear interval on unmount
  useEffect(() => clearInterval, [clearInterval]);

  return treasuryMetrics;
}
