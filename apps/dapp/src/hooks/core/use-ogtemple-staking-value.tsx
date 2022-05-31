import { useWallet } from 'providers/WalletProvider';
import useRequestState from 'hooks/use-request-state';
import { useStaking } from 'providers/StakingProvider';

export const useOGTempleStakingValue = () => {
  const { signer, wallet, balance } = useWallet();
  const { getRewardsForOGT } = useStaking();

  const handler = async (amount: number) => {
    if (!signer || !wallet) {
      console.error('Attempted to getRewardsForOGT staking value without a signer.');
      return;
    }

    const rewards = await getRewardsForOGT(amount);
    return rewards;
  };

  return useRequestState(handler);
};
