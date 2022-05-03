import {
  Vault__factory,
} from 'types/typechain';
import { useWallet } from 'providers/WalletProvider';
import useRequestState from 'hooks/use-request-state';

import { fromAtto } from 'utils/bigNumber';

export const useVaultBalance = (vaultContractAddress: string) => {
  const { signer, wallet } = useWallet();
  
  const getBalance = async () => {
    if (!signer || !wallet) {
      console.error(`
        Attempted to deposit to vault: ${vaultContractAddress} without a valid signer or wallet address.
      `);
      return;
    }

    const vault = new Vault__factory(signer).attach(vaultContractAddress);
    const balance = await vault.balanceOf(wallet);
    return fromAtto(balance);
  };
  
  return useRequestState(getBalance);
};
