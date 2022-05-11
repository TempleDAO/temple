import { Signer } from 'ethers';

import {
  Vault__factory,
  TempleERC20Token__factory,
  JoiningFee__factory,
} from 'types/typechain';
import { toAtto, fromAtto } from 'utils/bigNumber';
import { useWallet } from 'providers/WalletProvider';
import useRequestState from 'hooks/use-request-state';
import { useNotification } from 'providers/NotificationProvider';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { VaultGroup, Vault } from 'components/Vault/types';

import { Callback } from './types';
import { useVaultContext, Operation } from 'components/Pages/Core/VaultContext';

const ENV = import.meta.env;

const getVaultJoiningFee = async (signer: Signer, activeVault: Vault) => {
  const vault = new Vault__factory(signer).attach(activeVault.id);
  const joiningFee = await vault.joiningFee();
  const feeFactory = new JoiningFee__factory(signer).attach(joiningFee);
  const bigNumberFee = await feeFactory.calc(activeVault.startDateSeconds, activeVault.periodDurationSeconds, vault.address);

  return fromAtto(bigNumberFee);
};

export const useDepositToVault = (vaultContractAddress: string, onSuccess?: Callback) => {
  const { signer, wallet, ensureAllowance } = useWallet();
  const { optimisticallyUpdateVaultStaked, activeVault } = useVaultContext();

  const { openNotification } = useNotification();

  const handler = async (amount: number) => {
    if (!signer || !wallet) {
      console.error(`
        Attempted to deposit to vault: ${vaultContractAddress} without a valid signer or wallet address.
      `);
      return;
    }

    const bigAmount = toAtto(amount);
    const temple = new TempleERC20Token__factory(signer).attach(ENV.VITE_PUBLIC_TEMPLE_ADDRESS);
    const vault = new Vault__factory(signer).attach(vaultContractAddress);
    
    await ensureAllowance(
      TICKER_SYMBOL.TEMPLE_TOKEN,
      temple,
      vault.address,
      bigAmount,
    );

    const fee = await getVaultJoiningFee(signer, activeVault);
    const tx = await vault.deposit(bigAmount);
    
    await tx.wait();

    optimisticallyUpdateVaultStaked(vaultContractAddress, Operation.Increase, amount - fee);

    openNotification({
      title: 'Deposit success',
      hash: tx.hash,
    });

    if (onSuccess) {
      await onSuccess();
    }
  };

  return useRequestState(handler);
};
