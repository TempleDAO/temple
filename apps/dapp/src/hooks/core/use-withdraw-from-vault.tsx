import { Vault__factory } from 'types/typechain';
import { toAtto } from 'utils/bigNumber';
import { useWallet } from 'providers/WalletProvider';
import { Callback } from './types';
import useRequestState from 'hooks/use-request-state';
import { useNotification } from 'providers/NotificationProvider';

export const useWithdrawFromVault = (vaultContractAddress: string, onSuccess?: Callback) => {
  const { signer, wallet } = useWallet();
  const { openNotification } = useNotification();

  const withdraw = async (amount: number) => {
    if (!signer || !wallet) {
      console.error(`
        Attempted to withdraw from vault: ${vaultContractAddress} without a valid signer.
      `);
      return;
    }

    const bigAmount = toAtto(amount);
    const vault = new Vault__factory(signer).attach(vaultContractAddress);
    
    const receipt = await vault.withdraw(bigAmount);
    await receipt.wait();

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

