import { useCallback, useState } from 'react';
import { useSigner } from 'wagmi';

import {
  Vault__factory,
  TempleERC20Token__factory,
} from 'types/typechain';
import { toAtto } from 'utils/bigNumber';
import useIsMounted from 'hooks/use-is-mounted';
import { Nullable } from 'types/util';

type MetaMaskError = Error & { data?: { message: string } };

type HookReturnType = [
  { 
    loading: boolean;
    error: Nullable<MetaMaskError>,
  },
  (amount: number) => Promise<void>,
];

const ENV = import.meta.env;

const useDepositToVault = (vaultContractAddress: string): HookReturnType => {
  const [{ data: signer }] = useSigner();
  const isMounted = useIsMounted();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Nullable<MetaMaskError>>(null);

  const deposit = useCallback(async (amount: number) => {
    if (!signer) {
      console.error(`
        Attempted to deposit to vault: ${vaultContractAddress} without a signer.`);
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const bigAmount = toAtto(amount);
      const wallet = await signer.getAddress();
      const temple = new TempleERC20Token__factory(signer).attach(ENV.VITE_PUBLIC_TEMPLE_ADDRESS);
      const vault = new Vault__factory(signer).attach(vaultContractAddress);
      const allowance = await temple.allowance(wallet, vault.address);

      if (allowance.lt(bigAmount)) {
        await temple.increaseAllowance(vault.address, bigAmount);
      }

      await vault.deposit(bigAmount);
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
  ]);
  
  return [{ loading, error }, deposit];
}

export default useDepositToVault;