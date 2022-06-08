import { BigNumber, ContractTransaction } from 'ethers';
import { parseUnits } from 'ethers/lib/utils';

import {
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

const TICKERS_WITH_BURN = new Set([
  TICKER_SYMBOL.TEMPLE_TOKEN,
  TICKER_SYMBOL.OG_TEMPLE_TOKEN,
]);

export const useDepositToVault = (vaultContractAddress: string, onSuccess?: Callback) => {
  const { signer, wallet, ensureAllowance } = useWallet();
  const { faith: { usableFaith } } = useFaith();
  const { optimisticallyUpdateVaultStaked, activeVault } = useVaultContext();
  const [getVaultJoiningFee] = useVaultJoiningFee(activeVault);
  const [getFaithDepositMultiplier] = useFaithDepositMultiplier();

  const { openNotification } = useNotification();

  const handler = async (token: TICKER_SYMBOL, amount: string, useFaith = false) => {
    if (!signer || !wallet) {
      console.error(`
        Attempted to deposit to vault: ${vaultContractAddress} without a valid signer or wallet address.
      `);
      return;
    }

    if (useFaith && !TICKERS_WITH_BURN.has(token)) {
      throw new Error(`Programming Error: Attmeped to burn faith with ${token}`);
    }
    
    const bigAmount = parseUnits(amount, 18);
    const temple = new TempleERC20Token__factory(signer).attach(ENV.VITE_PUBLIC_TEMPLE_ADDRESS);
    const vaultProxy = new VaultProxy__factory(signer).attach(ENV.VITE_PUBLIC_TEMPLE_VAULT_PROXY);
    
    await ensureAllowance(
      TICKER_SYMBOL.TEMPLE_TOKEN,
      temple,
      vaultProxy.address,
      bigAmount,
    );

    const bigUsableFaith = toAtto(usableFaith);

    let expectedDepositAmount = bigAmount;
    // If the user is depositing with FAITH, the will get a boosted amount of TEMPLE deposited.
    // we need to calculate the deposit amount plus the amount of TEMPLE the FAITH converts to.
    if (useFaith) {
      expectedDepositAmount = await getFaithDepositMultiplier(amount) || bigAmount;
    }

    const fee = await getVaultJoiningFee() || BigNumber.from(0);
    
    // Deposit through vault proxy.
    let tx: ContractTransaction;
    if (useFaith) {
      if (token === TICKER_SYMBOL.TEMPLE_TOKEN) {
        tx = await vaultProxy.depositTempleWithFaith(bigAmount, bigUsableFaith, vaultContractAddress, {
          gasLimit: 450000,
        });
      } else {
        tx = await vaultProxy.unstakeAndDepositTempleWithFaith(bigAmount, bigUsableFaith, vaultContractAddress, {
          gasLimit: 450000,
        });
      }
    } else if (token === TICKER_SYMBOL.TEMPLE_TOKEN) {
      tx = await vaultProxy.depositTempleFor(bigAmount, vaultContractAddress);
    } else if (token === TICKER_SYMBOL.OG_TEMPLE_TOKEN) {
      tx = await vaultProxy.unstakeAndDepositIntoVault(bigAmount, vaultContractAddress);
    } else {
      throw new Error(`Programming Error: Unsupported token: ${token}`);
    }

    await tx.wait();

    optimisticallyUpdateVaultStaked(vaultContractAddress, Operation.Increase, expectedDepositAmount.sub(fee));

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
