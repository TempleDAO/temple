import { Vault__factory } from 'types/typechain';
import { useWallet } from 'providers/WalletProvider';
import useRequestState from 'hooks/use-request-state';

export const useIsVaultExitable = (vaultAddress: string) => {
  const { signer } = useWallet();

  const getIsVaultExitable = async () => {
    if (!signer) {
      return false;
    }

    const vault = new Vault__factory(signer).attach(vaultAddress);
    return vault.canExit();
  };

  return useRequestState(getIsVaultExitable);
};
