import { createContext, FC, useEffect, useContext } from 'react';

import { VaultGroup, Vault } from 'components/Vault/types';
import { useVaultGroupBalances, VaultGroupBalance, Operation } from 'hooks/core/use-vault-group-token-balance';
import { asyncNoop, noop } from 'utils/helpers';
import { Nullable } from 'types/util';

interface VaultContextType {
  vaultGroup: Nullable<VaultGroup>;
  activeVault: Nullable<Vault>;
  balances: VaultGroupBalance;
  refreshVaultBalance: (address: string) => Promise<void>,
  optimisticallyUpdateVaultStaked: (address: string, operation: Operation, amount: number) => void;
}

export { Operation };

export const VaultContext = createContext<VaultContextType>({
  balances: {},
  refreshVaultBalance: asyncNoop,
  optimisticallyUpdateVaultStaked: noop,
  vaultGroup: null,
  activeVault: null,
});

interface Props {
  vaultGroup: VaultGroup;
}

export const VaultContextProvider: FC<Props> = ({ children, vaultGroup }) => {
  const {
    balances,
    fetchVaultBalance: refetchVaultBalance,
    optimisticallyUpdateVaultStaked: updateStakedAmount,
  } = useVaultGroupBalances([vaultGroup]);
  const activeVault = vaultGroup.vaults.find(({ isActive }) => isActive)!;

  useEffect(() => {
    if (!activeVault) {
      console.error(`VaultGroupError: There is no currently active vault for VaultGroup: ${vaultGroup.id}.`);
    }
  }, [activeVault]);

  const refreshVaultBalance = (vaultAddress: string) => refetchVaultBalance(vaultGroup.id, vaultAddress);
  const optimisticallyUpdateVaultStaked =
    (vaultAddress: string, operation: Operation, amount: number) => updateStakedAmount(
      vaultGroup.id,
      vaultAddress,
      operation,
      amount,
    );

  return (
    <VaultContext.Provider
      value={{
        balances: balances[vaultGroup.id] || {},
        refreshVaultBalance,
        vaultGroup,
        activeVault,
        optimisticallyUpdateVaultStaked,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export const useVaultContext = () => {
  const context = useContext(VaultContext);

  return {
    ...context,
    vaultGroup: context.vaultGroup!,
    activeVault: context.activeVault!,
  };
};