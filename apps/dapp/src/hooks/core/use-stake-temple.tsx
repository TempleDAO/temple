import useRequestState from 'hooks/use-request-state';
import { useWallet } from 'providers/WalletProvider';
import { useStaking } from 'providers/StakingProvider';
import { getBigNumberFromString } from 'components/Vault/utils';

type Callback = () => void | (() => Promise<void>);

export const useStakeTemple = (onSuccess?: Callback) => {
  const { wallet, signer } = useWallet();
  const { stake } = useStaking();

  const stakeRequest = async (amount: string) => {
    if (!wallet || !signer) {
      console.error(
        'Missing wallet or signer when trying to unstake OGTemple.'
      );
      return;
    }

    const bigAmount = getBigNumberFromString(amount);

    await stake(bigAmount);

    if (onSuccess) {
      await onSuccess();
    }
  };

  return useRequestState(stakeRequest);
};
