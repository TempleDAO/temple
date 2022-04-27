import { useCallback, useState } from 'react';

import {
  Vault__factory,
  TempleERC20Token__factory,
} from 'types/typechain';
import { toAtto } from 'utils/bigNumber';
import useIsMounted from 'hooks/use-is-mounted';
import { Nullable } from 'types/util';
import { useWallet } from 'providers/WalletProvider';

type MetaMaskError = Error & { data?: { message: string } };

type HookReturnType = [
  { 
    loading: boolean;
    error: Nullable<MetaMaskError>,
  },
  (amount: number) => Promise<void>,
];

const ENV = import.meta.env;

type Callback = () => Promise<void> | (() => void);

export const useDepositToVault = (vaultContractAddress: string, onSuccess?: Callback): HookReturnType => {
  const { signer, wallet } = useWallet();
  const isMounted = useIsMounted();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Nullable<MetaMaskError>>(null);

  const deposit = useCallback(async (amount: number) => {
    if (!signer || !wallet) {
      console.error(`
        Attempted to deposit to vault: ${vaultContractAddress} without a valid signer or wallet address.
      `);
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const bigAmount = toAtto(amount);
      const temple = new TempleERC20Token__factory(signer).attach(ENV.VITE_PUBLIC_TEMPLE_ADDRESS);
      const vault = new Vault__factory(signer).attach(vaultContractAddress);
      const allowance = await temple.allowance(wallet, vault.address);

      if (allowance.lt(bigAmount)) {
        await temple.increaseAllowance(vault.address, bigAmount);
      }

      const receipt = await vault.deposit(bigAmount);
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
  
  return [{ loading, error }, deposit];
};

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

