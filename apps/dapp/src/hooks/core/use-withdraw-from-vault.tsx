import { Vault__factory } from 'types/typechain';
import { toAtto } from 'utils/bigNumber';
import { useWallet } from 'providers/WalletProvider';
import { Callback } from './types';
import useRequestState from 'hooks/use-request-state';
import { useNotification } from 'providers/NotificationProvider';
import { Operation, useVaultContext } from 'components/Pages/Core/VaultContext';
import { getBigNumberFromString } from 'components/Vault/utils';

export const useWithdrawFromVault = (vaultContractAddress: string, onSuccess?: Callback) => {
  const { signer, wallet } = useWallet();
  const { openNotification } = useNotification();
  const { optimisticallyUpdateVaultStaked } = useVaultContext();

  const withdraw = async (amount: string) => {
    if (!signer || !wallet) {
      console.error(`
        Attempted to withdraw from vault: ${vaultContractAddress} without a valid signer.
      `);
      return;
    }

    const bigAmount = getBigNumberFromString(amount);
    const vault = new Vault__factory(signer).attach(vaultContractAddress);
    
    const receipt = await vault.withdraw(bigAmount);
    await receipt.wait();

    optimisticallyUpdateVaultStaked(vaultContractAddress, Operation.Decrease, bigAmount);

    openNotification({
      title: 'Withdraw success',
      hash: receipt.hash,
    });
    
    if (onSuccess) {
      await onSuccess();
    }
  };
  
  return useRequestState(withdraw);
};

