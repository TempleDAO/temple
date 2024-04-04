import { useWallet } from 'providers/WalletProvider';
import useRequestState from 'hooks/use-request-state';
import { useStaking } from 'providers/StakingProvider';
import { getBigNumberFromString } from 'components/Vault/utils';

export const useOGTempleStakingValue = () => {
  const { signer, wallet } = useWallet();
  const { getRewardsForOGT } = useStaking();

  const handler = async (amount: string) => {
    if (!signer || !wallet) {
      console.error(
        'Attempted to getRewardsForOGT staking value without a signer.'
      );
      return;
    }

    const bigNumber = getBigNumberFromString(amount);
    const rewards = await getRewardsForOGT(bigNumber);
    return rewards;
  };

  return useRequestState(handler);
};
