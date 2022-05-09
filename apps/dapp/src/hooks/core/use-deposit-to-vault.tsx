import {
  Vault__factory,
  TempleERC20Token__factory,
} from 'types/typechain';
import { toAtto, fromAtto } from 'utils/bigNumber';
import { useWallet } from 'providers/WalletProvider';
import useRequestState from 'hooks/use-request-state';
import { useNotification } from 'providers/NotificationProvider';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';

import { Callback } from './types';

const ENV = import.meta.env;

export const useDepositToVault = (vaultContractAddress: string, onSuccess?: Callback) => {
  const { signer, wallet, ensureAllowance } = useWallet();
  const { openNotification } = useNotification();

  const handler = async (amount: number) => {
    if (!signer || !wallet) {
      console.error(`
        Attempted to deposit to vault: ${vaultContractAddress} without a valid signer or wallet address.
      `);
      return;
    }

    const bigAmount = toAtto(amount);
    const temple = new TempleERC20Token__factory(signer).attach(ENV.VITE_PUBLIC_TEMPLE_ADDRESS);
    const vault = new Vault__factory(signer).attach(vaultContractAddress);
  
    await ensureAllowance(
      TICKER_SYMBOL.TEMPLE_TOKEN,
      temple,
      vault.address,
      bigAmount,
    );

  
    const tx = await vault.deposit(bigAmount);
    
    

    const receipt = await tx.wait();

     // @ts-ignore
     const depositEvent = await vault.filters.Deposit(null);
     const events = await vault.queryFilter(depositEvent)
       console.log('events ', events)

    openNotification({
      title: 'Deposit success',
      hash: tx.hash,
    });

    if (onSuccess) {
      await onSuccess();
    }
  };

  return useRequestState(handler);
};
