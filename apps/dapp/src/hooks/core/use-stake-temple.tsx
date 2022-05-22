import useRequestState from 'hooks/use-request-state';
import { useWallet } from 'providers/WalletProvider';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { toAtto } from 'utils/bigNumber';
import { useStaking } from 'providers/StakingProvider';

const ENV = import.meta.env;

type Callback = () => void | (() => Promise<void>);

export const useStakeTemple = (onSuccess?: Callback) => {
  const { wallet, signer } = useWallet();
  const { stake } = useStaking();

  const stakeRequest = async (amount: number) => {
    if (!wallet || !signer) {
      console.error('Missing wallet or signer when trying to unstake OGTemple.');
      return;
    }

    await stake(toAtto(amount));

    if (onSuccess) {
      await onSuccess();
    }
  };

  return useRequestState(stakeRequest);
};
