import { useEffect, useState, useCallback, useMemo } from 'react';
import useInterval from 'use-interval';
import { MetricsService, AccountMetrics } from 'services/MetricsService';
import { useWallet } from 'providers/WalletProvider';
import { useStaking } from 'providers/StakingProvider';
import { useRefreshWalletState } from 'hooks/use-refresh-wallet-state';

export default function useRefreshableAccountMetrics() {
  const { wallet, balance } = useWallet();
  const { exitQueueData } = useStaking();
  const [accountMetrics, setAccountMetrics] = useState<AccountMetrics | null>(
    null
  );
  const refreshWalletState = useRefreshWalletState();

  const metricsService = useMemo(() => new MetricsService(), []);

  const refreshMetrics = useCallback(async () => {
    if (!wallet || !balance || !exitQueueData) {
      return;
    }

    const accountMetrics = await metricsService.getAccountMetrics(wallet);
    if (accountMetrics) {
      const walletValue =
        accountMetrics.templeBalance * accountMetrics.templeValue;
      const exitQueueValue =
        exitQueueData.totalTempleOwned * accountMetrics.templeValue;
      const ogTempleWalletValue =
        balance.ogTemple * accountMetrics.ogTemplePrice;
      const lockedOGTempleValue =
        balance.ogTempleLocked * accountMetrics.ogTemplePrice;
      const netWorth =
        lockedOGTempleValue +
        walletValue +
        ogTempleWalletValue +
        exitQueueValue;
      setAccountMetrics({
        ...accountMetrics,
        walletValue,
        exitQueueTotal: exitQueueData.totalTempleOwned,
        exitQueueValue,
        ogTempleWallet: balance.ogTemple,
        ogTempleWalletValue,
        lockedOGTemple: balance.ogTempleLocked,
        lockedOGTempleValue,
        netWorth,
        netWorthTemple: netWorth / accountMetrics.templeValue,
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
