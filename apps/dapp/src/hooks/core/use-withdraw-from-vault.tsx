import { VaultEarlyWithdraw__factory, Vault__factory } from 'types/typechain';
import { useWallet } from 'providers/WalletProvider';
import { Callback } from './types';
import useRequestState from 'hooks/use-request-state';
import { useNotification } from 'providers/NotificationProvider';
import { Operation, useVaultContext } from 'pages/Core/VaultContext';
import { getBigNumberFromString } from 'components/Vault/utils';
import { BigNumber, Contract } from 'ethers';
import { useState } from 'react';
import env from 'constants/env';

export const useWithdrawFromVault = (vaultContractAddress: string, onSuccess?: Callback) => {
  const { signer, wallet } = useWallet();
  const { openNotification } = useNotification();
  const { optimisticallyUpdateVaultStaked } = useVaultContext();

  const withdrawEarly = async (subvaultAddress: string, amount: string) => {
    if (!signer || !wallet) {
      console.error(`
        Attempted to withdraw early from vault: ${env.contracts.vaultEarlyExit} without a valid signer.
      `);
      return;
    }

    const bigAmount = getBigNumberFromString(amount);
    const vaultEarlyWithdrawal = new VaultEarlyWithdraw__factory(signer).attach(env.contracts.vaultEarlyExit);

    const receipt = await vaultEarlyWithdrawal.withdraw(subvaultAddress, bigAmount, { gasLimit: 400000 });
    await receipt.wait();

    optimisticallyUpdateVaultStaked(vaultContractAddress, Operation.Decrease, bigAmount);

    openNotification({
      title: 'Early withdraw success',
      hash: receipt.hash,
    });

    if (onSuccess) {
      await onSuccess();
    }
  };

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

  return {
    withdraw: useRequestState(withdraw),
    withdrawEarly: useRequestState(withdrawEarly),
  };
};
