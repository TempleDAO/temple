import { useCallback, useState } from 'react';
import { Vault__factory } from 'types/typechain';
import { toAtto } from 'utils/bigNumber';
import useIsMounted from 'hooks/use-is-mounted';
import { Nullable } from 'types/util';
import { useWallet } from 'providers/WalletProvider';
import { Callback, MetaMaskError, HookReturnType } from './types';

const ENV = import.meta.env;

export const useWithdrawFromVault = (vaultContractAddress: string, onSuccess?: Callback): HookReturnType => {
  const { signer, wallet } = useWallet();
  const isMounted = useIsMounted();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Nullable<MetaMaskError>>(null);

  const withdraw = useCallback(async (amount: number) => {
    if (!signer || !wallet) {
      console.error(`
        Attempted to withdraw from vault: ${vaultContractAddress} without a valid signer.
      `);
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const bigAmount = toAtto(amount);
      const vault = new Vault__factory(signer).attach(vaultContractAddress);
      
      const receipt = await vault.withdraw(bigAmount);
      await receipt.wait();
     
      if (onSuccess) {
        await onSuccess();
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err as MetaMaskError);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [
    signer,
    vaultContractAddress,
    isMounted,
    setLoading,
    setError,
    wallet,
  ]);
  
  return [{ loading, error }, withdraw];
};

