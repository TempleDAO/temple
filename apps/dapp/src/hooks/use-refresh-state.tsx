import { useWallet } from 'providers/WalletProvider';
import { useSwap } from 'providers/SwapProvider';
import { useStaking } from 'providers/StakingProvider';
import { useFaith } from 'providers/FaithProvider';

/**
 * Load new data for the connected wallet
 */
export const useRefreshState = async () => {
  const { updateTemplePrice } = useSwap();
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

  if (isConnected()) {
    return await Promise.all([
      updateTemplePrice(),
      updateCurrentEpoch(),
      updateBalance(),
      updateFaith(),
      updateLockedEntries(),
      updateExitQueueData(),
      updateApy(),
    ]);
  }
  return Promise.reject();
};
