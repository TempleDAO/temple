import { useCallback, useState } from 'react';
import {
  Vault__factory,
  TempleERC20Token__factory,
} from 'types/typechain';
import { toAtto } from 'utils/bigNumber';
import { Nullable } from 'types/util';
import { useWallet } from 'providers/WalletProvider';
import useRequestState from 'hooks/use-request-state';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';

import { Callback } from './types';

const ENV = import.meta.env;

export const useDepositToVault = (vaultContractAddress: string, onSuccess?: Callback) => {
  const { signer, wallet, ensureAllowance } = useWallet();

  const handler = useCallback(async (amount: number) => {
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
      vaultContractAddress,
      bigAmount
    );

    const allowance = await temple.allowance(wallet, vault.address);

    if (allowance.lt(bigAmount)) {
      await temple.increaseAllowance(vault.address, bigAmount);
    }

    const receipt = await vault.deposit(bigAmount);
    await receipt.wait();
    
    if (onSuccess) {
      await onSuccess();
    }
  }, [
    wallet,
    signer,
    vaultContractAddress
  ]);

  return useRequestState(handler);
};
