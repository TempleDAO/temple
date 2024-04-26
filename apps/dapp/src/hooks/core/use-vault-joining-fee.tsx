import { Signer } from 'ethers';

import { Vault__factory, JoiningFee__factory } from 'types/typechain';
import { useWallet } from 'providers/WalletProvider';
import useRequestState from 'hooks/use-request-state';
import { Vault } from 'components/Vault/types';

const getVaultJoiningFee = async (signer: Signer, activeVault: Vault) => {
  const vault = new Vault__factory(signer).attach(activeVault.id);
  const joiningFee = await vault.joiningFee();
  const feeFactory = new JoiningFee__factory(signer).attach(joiningFee);
  const bigNumberFee = await feeFactory.calc(
    activeVault.startDateSeconds,
    activeVault.periodDurationSeconds,
    vault.address
  );

  return bigNumberFee;
};

// This call returns the joining fee per Temple deposited.
// To calculate the joining fee for a deposit the response from `getVaultJoiningFee`
// should be multiplied by the number of Temple being deposited.
export const useVaultJoiningFee = (vault: Vault) => {
  const { signer } = useWallet();

  const getJoiningFee = async () => {
    if (!signer) {
      console.error(
        `Attempted to deposit to vault: ${vault.id} without a valid signer.`
      );
      return;
    }

    return await getVaultJoiningFee(signer, vault);
  };

  return useRequestState(getJoiningFee);
};
