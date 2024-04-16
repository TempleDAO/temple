import { useCallback, useState } from 'react';
import { useWallet } from 'providers/WalletProvider';
import { useSwap } from 'providers/SwapProvider';
import { useStaking } from 'providers/StakingProvider';
import { useFaith } from 'providers/FaithProvider';

/**
 * Load new data for the connected wallet
 */
export const useRefreshWalletState = (): [
  { isLoading: boolean },
  () => Promise<void>
] => {
  const [isLoading, setIsLoading] = useState(false);
  const { updateFaith } = useFaith();
  const { isConnected, updateBalance } = useWallet();
  const { updateApy, updateLockedEntries } = useStaking();

  const refresh = useCallback(async () => {
    if (!isConnected) {
      return;
    }

    setIsLoading(true);

    try {
      await Promise.all([
        updateBalance(),
        updateFaith(),
        updateLockedEntries(),
        updateApy(),
      ]);
    } catch (e) {
      console.error('Failed to refresh wallet state', e);
    } finally {
      setIsLoading(false);
    }
  }, [
    isConnected,
    updateBalance,
    updateFaith,
    updateLockedEntries,
    updateApy,
    setIsLoading,
  ]);

  return [
    {
      isLoading,
    },
    refresh,
  ];
};
