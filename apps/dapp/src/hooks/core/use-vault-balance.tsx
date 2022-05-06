import { useEffect } from 'react';
import {
  Vault__factory,
} from 'types/typechain';
import { useWallet } from 'providers/WalletProvider';
import useRequestState from 'hooks/use-request-state';

import { fromAtto } from 'utils/bigNumber';
import { Nullable } from 'types/util';

type HookResponseType = [
  {
    isLoading: boolean;
    balance: Nullable<number>,
    error: Nullable<Error>,
  },
  () => Promise<void>,
] 

export const useVaultBalance = (vaultContractAddress: string): HookResponseType => {
  const { signer, wallet, isConnected } = useWallet();
  
  const getBalance = async () => {
    if (!signer || !wallet) {
      console.error(`
        Attempted to getBalance for vault: ${vaultContractAddress} without a valid signer or wallet address.
      `);
      return;
    }

    const vault = new Vault__factory(signer).attach(vaultContractAddress);
    const shares = await vault.shareBalanceOf(wallet);
    const tokenShareBalance = await vault.toTokenAmount(shares);
    return fromAtto(tokenShareBalance);
  };

  const [getBalanceRequest, { isLoading, error, response: balance }] = useRequestState(getBalance);

  useEffect(() => {
    if (!isConnected) {
      return;
    }

    getBalanceRequest();
  }, [
    isConnected,
    vaultContractAddress,
    getBalanceRequest,
  ]);
  

  return [
    {
      isLoading,
      balance,
      error,
    },
    getBalanceRequest,
  ];
};
