import { useEffect, useState } from 'react';
import useInterval from 'use-interval';
import { MetricsService, AccountMetrics } from 'services/MetricsService';
import { useWallet } from 'providers/WalletProvider';

export default function useRefreshableAccountMetrics(wallet: string) {
  const { updateWallet } = useWallet();
  const [AccountMetrics, setAccountMetrics] = useState<AccountMetrics | null>(
    null
  );

  const metricsService = new MetricsService();

  async function refreshMetrics() {
    const AccountMetrics = await metricsService.getAccountMetrics(wallet);
    updateWallet();
    setAccountMetrics(AccountMetrics);
  }

  const clearInterval = useInterval(refreshMetrics, 20 * 60 * 1000, true);

  // clear interval on unmount
  useEffect(() => clearInterval, [clearInterval]);

  return AccountMetrics;
}
