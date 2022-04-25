import { useCallback, useState } from 'react';
import { useSigner } from 'wagmi';
import {
  Vault__factory,
} from 'types/typechain';
import { toAtto } from 'utils/bigNumber';
import useIsMounted from 'hooks/use-is-mounted';
import { Nullable } from 'types/util';

const useDepositToVault = (vaultContractAddress: string) => {
  const [{ data: signer }] = useSigner();
  const isMounted = useIsMounted();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Nullable<Error>>(null);

  const deposit = useCallback(async (amount: number) => {
    if (!signer) {
      console.error(`Attempted to deposit to vault: ${vaultContractAddress} without a signer.`);
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const vault = new Vault__factory(signer).attach(vaultContractAddress);
      await vault.deposit(toAtto(amount));
    } catch (err) {
      if (isMounted.current) {
        setError(error as Error);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [signer, vaultContractAddress, isMounted, setLoading, setError]);
  
  return [{ loading, error }, deposit];
}

export default useDepositToVault;