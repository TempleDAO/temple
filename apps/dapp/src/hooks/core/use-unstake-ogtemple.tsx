import {
  OGTemple__factory,
  TempleStaking__factory,
} from 'types/typechain';

import useRequestState from 'hooks/use-request-state';
import { useWallet } from 'providers/WalletProvider';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { useStaking } from 'providers/StakingProvider';
import { getBigNumberFromString } from 'components/Vault/utils';

const ENV = import.meta.env;

type Callback = () => void | (() => Promise<void>);

export const useUnstakeOGTemple = (onSuccess?: Callback) => {
  const { wallet, signer, ensureAllowance } = useWallet();
  const { unstake } = useStaking();

  const unstakeRequest = async (amount: string) => {
    if (!wallet || !signer) {
      console.error('Missing wallet or signer when trying to unstake OGTemple.');
      return;
    }
  
    const templeStaking = new TempleStaking__factory(signer).attach(ENV.VITE_PUBLIC_TEMPLE_STAKING_ADDRESS);
    const ogTempleAddress = await templeStaking.OG_TEMPLE();
    const ogTempleToken = new OGTemple__factory(signer).attach(ogTempleAddress);
    const bigAmount = getBigNumberFromString(amount);

    await ensureAllowance(
      TICKER_SYMBOL.OG_TEMPLE_TOKEN,
      ogTempleToken,
      ENV.VITE_PUBLIC_TEMPLE_STAKING_ADDRESS,
      bigAmount
    );

    await unstake(bigAmount);

    if (onSuccess) {
      await onSuccess();
    }
  };

  return useRequestState(unstakeRequest);
};
