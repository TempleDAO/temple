import { useEffect, useState, useCallback, useMemo } from 'react';
import useInterval from 'use-interval';
import { MetricsService, AccountMetrics } from 'services/MetricsService';
import { useWallet } from 'providers/WalletProvider';
import { useRefreshWalletState } from 'hooks/use-refresh-wallet-state';

export default function useRefreshableAccountMetrics() {
  const { wallet } = useWallet();
  const [accountMetrics, setAccountMetrics] = useState<AccountMetrics | null>(
    null
  );
  const refreshWalletState = useRefreshWalletState();

  const metricsService = useMemo(() => new MetricsService(), []);

  const refreshMetrics = useCallback(async () => {
    if (!wallet) {
      return;
    }
    const accountMetrics = await metricsService.getAccountMetrics(wallet);
    if (accountMetrics) {
      setAccountMetrics({
        ...accountMetrics,
      });
    }
  }, [wallet, metricsService]);

  useEffect(() => {
    async function onMount() {
      await refreshWalletState();
    }
    onMount();
  }, []);

  useEffect(() => {
    refreshMetrics();
  }, [refreshMetrics]);

  const clearInterval = useInterval(refreshMetrics, 20 * 60 * 1000, true);

  // clear interval on unmount
  useEffect(() => clearInterval, [clearInterval]);

  return accountMetrics;
}
