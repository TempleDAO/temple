import { createContext, FC, useEffect, useContext, useMemo } from 'react';
import { BigNumber } from 'ethers';
import { useParams } from 'react-router-dom';

import { VaultGroup, Vault } from 'components/Vault/types';
import { useListCoreVaultGroups } from 'hooks/core/subgraph';
import { useVaultGroupBalances, Operation, VaultGroupBalances } from 'hooks/core/use-vault-group-token-balance';
import { asyncNoop, noop } from 'utils/helpers';
import { Nullable } from 'types/util';

interface VaultContextType {
  vaultGroups: VaultGroup[];
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
  vaultGroups: [],
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
        vaultGroups,
        optimisticallyUpdateVaultStaked,
        isLoading: vaultsLoading || balancesLoading,
        error,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

type UseVaultContextHookValues = VaultContextType & {
  activeVault?: Vault;
  vaultGroup?: VaultGroup;
};

export const useVaultContext = (): UseVaultContextHookValues => {
  const { vaultId } = useParams();
  const { vaultGroups, ...rest } = useContext(VaultContext);

  const vaultGroup = vaultGroups.find((vaultGroup) => {
    return vaultGroup.id === vaultId;
  });

  const activeVault = vaultGroup?.vaults.find(({ isActive }) => !!isActive);

  return {
    ...rest,
    vaultGroups,
    vaultGroup,
    activeVault,
  };
};
