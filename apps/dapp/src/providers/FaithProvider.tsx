import { useState, useContext, createContext, PropsWithChildren } from 'react';
import { BigNumber, Signer } from 'ethers';
import { useNotification } from 'providers/NotificationProvider';
import { useWallet } from 'providers/WalletProvider';
import { FaithService } from 'providers/types';
import { NoWalletAddressError } from 'providers/errors';
import { asyncNoop } from 'utils/helpers';
import { fromAtto } from 'utils/bigNumber';
import { formatNumber } from 'utils/formatter';
import { Faith__factory } from 'types/typechain';
import env from 'constants/env';

import { ZERO } from 'utils/bigNumber';

const INITIAL_STATE: FaithService = {
  faith: {
    usableFaith: ZERO,
    lifeTimeFaith: 0,
    totalSupply: 0,
    share: 0,
  },
  updateFaith: asyncNoop,
};

const FaithContext = createContext(INITIAL_STATE);

// eslint-disable-next-line @typescript-eslint/ban-types
export const FaithProvider = (props: PropsWithChildren<{}>) => {
  const [faith, setFaith] = useState(INITIAL_STATE.faith);

  const { wallet, signer, ensureAllowance } = useWallet();
  const { openNotification } = useNotification();

  const getFaith = async (walletAddress: string, signerState: Signer) => {
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }

    const FAITH = new Faith__factory(signerState).attach(env.contracts.faith);

    const faithBalances = await FAITH.balances(walletAddress);
    const totalSupply = await FAITH.totalSupply();
    const totalFaithSupply = fromAtto(totalSupply);
    const lifeTimeFaith = fromAtto(faithBalances.lifeTimeFaith);
    const usableFaith = faithBalances.usableFaith;

    return {
      lifeTimeFaith: lifeTimeFaith,
      usableFaith: usableFaith,
      totalSupply: totalFaithSupply,
      // TODO
      share: formatNumber((fromAtto(usableFaith) * 100) / totalFaithSupply),
    };
  };

  const updateFaith = async () => {
    if (!wallet || !signer) {
      return;
    }

    const faith = await getFaith(wallet, signer);
    setFaith(faith);
  };

  return (
    <FaithContext.Provider
      value={{
        faith,
        updateFaith,
      }}
    >
      {props.children}
    </FaithContext.Provider>
  );
};

export const useFaith = () => useContext(FaithContext);
