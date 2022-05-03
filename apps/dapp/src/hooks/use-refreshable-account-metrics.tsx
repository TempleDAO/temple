import { useEffect, useState, useCallback, useMemo } from 'react';
import useInterval from 'use-interval';
import { MetricsService, AccountMetrics } from 'services/MetricsService';
import { useWallet } from 'providers/WalletProvider';
import { useStaking } from 'providers/StakingProvider';
import { useRefreshWalletState } from 'hooks/use-refresh-wallet-state';

export default function useRefreshableAccountMetrics() {
  const { wallet, balance } = useWallet();
  const [accountMetrics, setAccountMetrics] = useState<AccountMetrics | null>(
    null
  );
  const [_, refreshWalletState] = useRefreshWalletState();
  const { exitQueueData } = useStaking();

  const metricsService = useMemo(() => new MetricsService(), []);

  const refreshMetrics = useCallback(async () => {
    if (!wallet || !balance || !exitQueueData) {
      return;
    }
    const accountMetrics = await metricsService.getAccountMetrics(wallet);
    if (accountMetrics) {
      setAccountMetrics({
        ...accountMetrics,
      });
    }
  }, [wallet, balance, exitQueueData, metricsService]);

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
