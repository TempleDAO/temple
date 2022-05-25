import {
  OGTemple__factory,
  TempleStaking__factory,
  InstantExitQueue__factory,
  VaultProxy__factory
} from 'types/typechain';

import useRequestState from 'hooks/use-request-state';
import { useWallet } from 'providers/WalletProvider';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { toAtto } from 'utils/bigNumber';
import { useStaking } from 'providers/StakingProvider';

const ENV = import.meta.env;

type Callback = () => void | (() => Promise<void>);

export const useUnstakeOGTemple = (onSuccess?: Callback) => {
  const { wallet, signer, ensureAllowance } = useWallet();
  const { unstake } = useStaking();

  const unstakeRequest = async (amount: number) => {
    if (!wallet || !signer) {
      console.error('Missing wallet or signer when trying to unstake OGTemple.');
      return;
    }
  
    const templeStaking = new TempleStaking__factory(signer).attach(ENV.VITE_PUBLIC_TEMPLE_STAKING_ADDRESS);
    const ogTempleAddress = await templeStaking.OG_TEMPLE();
    const ogTempleToken = new OGTemple__factory(signer).attach(ogTempleAddress);

    await ensureAllowance(
      TICKER_SYMBOL.OG_TEMPLE_TOKEN,
      ogTempleToken,
      ENV.VITE_PUBLIC_TEMPLE_STAKING_ADDRESS,
      toAtto(amount)
    );

    await unstake(toAtto(amount));

    if (onSuccess) {
      await onSuccess();
    }
  };

  return useRequestState(unstakeRequest);
};
