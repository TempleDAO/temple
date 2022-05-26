import { BigNumber, ContractTransaction, Signer } from 'ethers';

import {
  Vault__factory,
  TempleERC20Token__factory,
  VaultProxy__factory,
} from 'types/typechain';
import { fromAtto, toAtto } from 'utils/bigNumber';
import { useWallet } from 'providers/WalletProvider';
import useRequestState from 'hooks/use-request-state';
import { useNotification } from 'providers/NotificationProvider';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';

import { Callback } from './types';
import { useVaultContext, Operation } from 'components/Pages/Core/VaultContext';
import { useVaultJoiningFee } from './use-vault-joining-fee';
import { useFaith } from 'providers/FaithProvider';
import { useFaithDepositMultiplier } from './use-faith-deposit-multiplier';

const ENV = import.meta.env;

export const useDepositToVault = (vaultContractAddress: string, onSuccess?: Callback) => {
  const { signer, wallet, ensureAllowance } = useWallet();
  const { faith: { usableFaith } } = useFaith();
  const { optimisticallyUpdateVaultStaked, activeVault } = useVaultContext();
  const [getVaultJoiningFee] = useVaultJoiningFee(activeVault);
  const [getFaithDepositMultiplier] = useFaithDepositMultiplier();

  const { openNotification } = useNotification();

  const handler = async (token: TICKER_SYMBOL, amount: number) => {
    if (!signer || !wallet) {
      console.error(`
        Attempted to deposit to vault: ${vaultContractAddress} without a valid signer or wallet address.
      `);
      return;
    }

    const bigAmount = toAtto(amount);
    const temple = new TempleERC20Token__factory(signer).attach(ENV.VITE_PUBLIC_TEMPLE_ADDRESS);
    const vaultProxy = new VaultProxy__factory(signer).attach(ENV.VITE_PUBLIC_TEMPLE_VAULT_PROXY);
    
    await ensureAllowance(
      TICKER_SYMBOL.TEMPLE_TOKEN,
      temple,
      vaultProxy.address,
      bigAmount,
    );

    const bigUsableFaith = toAtto(usableFaith);

    let expectedDepositAmount = amount;
    // If the user is depositing with FAITH, the will get a boosted amount of TEMPLE deposited.
    // we need to calculate the deposit amount plus the amount of TEMPLE the FAITH converts to.
    if (token === TICKER_SYMBOL.FAITH) {
      expectedDepositAmount = await getFaithDepositMultiplier(amount) || amount;
    }

    const fee = await getVaultJoiningFee() || 0;
    
    // Deposit through vault proxy.
    let tx: ContractTransaction;
    if (token === TICKER_SYMBOL.TEMPLE_TOKEN) {
      tx = await vaultProxy.depositTempleFor(bigAmount, vaultContractAddress);
    } else if (token === TICKER_SYMBOL.FAITH) {
      tx = await vaultProxy.depositTempleWithFaith(bigAmount, bigUsableFaith, vaultContractAddress);
    } else {
      throw new Error(`Programming Error: Unsupported token: ${token}`);
    }

    await tx.wait();

    optimisticallyUpdateVaultStaked(vaultContractAddress, Operation.Increase, expectedDepositAmount - fee);

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
