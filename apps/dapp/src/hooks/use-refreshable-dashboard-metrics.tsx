import { useEffect, useState } from 'react';
import useInterval from 'use-interval';
import { MetricsService, DashboardMetrics } from 'services/MetricsService';

export default function useRefreshableDashboardMetrics() {
  const [dashboardMetrics, setDashboardMetrics] =
    useState<DashboardMetrics | null>(null);

  const metricsService = new MetricsService();

  async function refreshMetrics() {
    const dashboardMetrics = await metricsService.getDashboardMetrics();
    setDashboardMetrics(dashboardMetrics);
  }

  const clearInterval = useInterval(refreshMetrics, 20 * 60 * 1000, true);

  // clear interval on unmount
  useEffect(() => clearInterval, [clearInterval]);

  return dashboardMetrics;
}
