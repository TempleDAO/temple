import { useEffect, useState } from 'react';
import useInterval from 'use-interval';
import { MetricsService, TreasuryMetrics } from 'services/MetricsService';

export default function useRefreshableTreasuryMetrics() {
  const [treasuryMetrics, setTreasuryMetrics] =
    useState<TreasuryMetrics | null>(null);

  async function refreshMetrics() {
    //@ts-ignore
    if (window.ethereum) {
      const metricsService = new MetricsService();

      const treasuryMetrics = await metricsService.getTreasuryMetrics();
      setTreasuryMetrics(treasuryMetrics);
    }
  }

  const clearInterval = useInterval(refreshMetrics, 5 * 60 * 1000, true);

  // clear interval on unmount
  useEffect(() => clearInterval, [clearInterval]);

  return treasuryMetrics;
}
