import { createContext, FC, useEffect, useContext, useMemo } from 'react';
import { BigNumber } from 'ethers';

import { VaultGroup, Vault } from 'components/Vault/types';
import { useListCoreVaultGroups } from 'hooks/core/subgraph';
import { useVaultGroupBalances, Operation, VaultGroupBalances } from 'hooks/core/use-vault-group-token-balance';
import { asyncNoop, noop } from 'utils/helpers';
import { Nullable } from 'types/util';

interface VaultContextType {
  vaultGroup: Nullable<VaultGroup>;
  vaultGroups: Nullable<VaultGroup[]>;
  activeVault: Nullable<Vault>;
  balances: VaultGroupBalances;
  refreshVaultBalance: (address: string) => Promise<void>,
  optimisticallyUpdateVaultStaked: (address: string, operation: Operation, amount: BigNumber) => void;
  isLoading: boolean;
  error: Nullable<Error>;
}

export { Operation };

export const VaultContext = createContext<VaultContextType>({
  balances: {},
  refreshVaultBalance: asyncNoop,
  optimisticallyUpdateVaultStaked: noop,
  vaultGroup: null,
  vaultGroups: null,
  activeVault: null,
  isLoading: false,
  error: null,
});

export const VaultContextProvider: FC = ({ children }) => {
  const { vaultGroups, isLoading: vaultsLoading, error } = useListCoreVaultGroups();
  const vaultGroup = vaultGroups[0];

  const {
    balances,
    fetchVaultBalance,
    optimisticallyUpdateVaultStaked: updateStakedAmount,
    isLoading: balancesLoading,
  } = useVaultGroupBalances(vaultGroups);

  const activeVault = vaultGroup?.vaults.find(({ isActive }) => isActive)!;

  useEffect(() => {
    if (!vaultGroup) {
      return;
    }

    if (!activeVault) {
      console.error(`VaultGroupError: There is no currently active vault for VaultGroup: ${vaultGroup.id}.`);
    }
  }, [activeVault, vaultGroup]);

  const optimisticallyUpdateVaultStaked =
    (vaultAddress: string, operation: Operation, amount: BigNumber) => updateStakedAmount(
      vaultAddress,
      operation,
      amount,
    );

  const getBalances = (balances: VaultGroupBalances, vaultGroup: VaultGroup) => {
    if (!vaultGroup) {
      return {};
    }

    return vaultGroup.vaults.reduce((acc, { id }) => ({
      ...acc,
      [id]: balances[id] || {},
    }), {});
  };

  return (
    <VaultContext.Provider
      value={{
        balances: getBalances(balances, vaultGroup),
        refreshVaultBalance: fetchVaultBalance,
        vaultGroup,
        vaultGroups,
        activeVault,
        optimisticallyUpdateVaultStaked,
        isLoading: vaultsLoading || balancesLoading,
        error,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export const useVaultContext = (vaultGroupId?: string) => {
  const context = useContext(VaultContext);

  return {
    ...context,
    vaultGroup: context.vaultGroup!,
    activeVault: context.activeVault!,
  };
};