import { useCallback } from 'react';
import { useWallet } from 'providers/WalletProvider';
import { useSwap } from 'providers/SwapProvider';
import { useStaking } from 'providers/StakingProvider';
import { useFaith } from 'providers/FaithProvider';

/**
 * Load new data for the connected wallet
 */
export const useRefreshWalletState = () => {
  const { updateTemplePrice, updateIv } = useSwap();
  const { updateFaith } = useFaith();
  const {
    isConnected,
    getBalance: updateBalance,
    getCurrentEpoch: updateCurrentEpoch,
  } = useWallet();
  const {
    updateApy,
    updateLockedEntries,
    getExitQueueData: updateExitQueueData,
  } = useStaking();

  return useCallback(async () => {
    if (!isConnected) {
      return;
    }
    try {
      await Promise.all([
        updateTemplePrice(),
        updateCurrentEpoch(),
        updateBalance(),
        updateFaith(),
        updateLockedEntries(),
        updateExitQueueData(),
        updateApy(),
        updateIv(),
      ]);
    } catch (e) {
      console.error('Failed to refresh wallet state', e);
    }
  }, [
    isConnected,
    updateTemplePrice,
    updateCurrentEpoch,
    updateBalance,
    updateFaith,
    updateLockedEntries,
    updateExitQueueData,
    updateApy,
  ]);
};
