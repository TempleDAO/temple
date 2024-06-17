import {
  createContext,
  FC,
  useEffect,
  useContext,
  useMemo,
  ReactNode,
} from 'react';
import { BigNumber } from 'ethers';
import { useParams } from 'react-router-dom';

import { VaultGroup, Vault } from 'components/Vault/types';
import { useListCoreVaultGroups } from 'hooks/core/subgraph';
import {
  useVaultGroupBalances,
  Operation,
  VaultGroupBalances,
} from 'hooks/core/use-vault-group-token-balance';
import { asyncNoop, noop } from 'utils/helpers';
import { Nullable } from 'types/util';

interface VaultContextType {
  vaultGroups: {
    isLoading: boolean;
    error: Nullable<Error>;
    vaultGroups: VaultGroup[];
  };
  balances: {
    isLoading: boolean;
    error: Nullable<Error>;
    balances: {
      [vaultGroupId: string]: VaultGroupBalances;
    };
  };
  refreshVaultBalance: (address: string) => Promise<void>;
  optimisticallyUpdateVaultStaked: (
    address: string,
    operation: Operation,
    amount: BigNumber
  ) => void;
}

export { Operation };

export const VaultContext = createContext<VaultContextType>({
  vaultGroups: {
    isLoading: false,
    vaultGroups: [],
    error: null,
  },
  balances: {
    isLoading: false,
    balances: {},
    error: null,
  },
  refreshVaultBalance: asyncNoop,
  optimisticallyUpdateVaultStaked: noop,
});

export const VaultContextProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const {
    vaultGroups,
    isLoading: vaultsLoading,
    error: vaultLoadingError,
  } = useListCoreVaultGroups();

  const {
    balances,
    fetchVaultBalance,
    optimisticallyUpdateVaultStaked: updateStakedAmount,
    isLoading: balancesLoading,
    error: vaultBalanceError,
  } = useVaultGroupBalances(vaultGroups);

  const optimisticallyUpdateVaultStaked = (
    vaultAddress: string,
    operation: Operation,
    amount: BigNumber
  ) => updateStakedAmount(vaultAddress, operation, amount);

  const getBalances = (balances: VaultGroupBalances) => {
    return vaultGroups.reduce((groupedBalances, group) => {
      return {
        ...groupedBalances,
        [group.id]: group.vaults.reduce(
          (acc, { id }) => ({
            ...acc,
            [id]: balances[id] || {},
          }),
          {}
        ),
      };
    }, {});
  };

  return (
    <VaultContext.Provider
      value={{
        vaultGroups: {
          vaultGroups,
          isLoading: vaultsLoading,
          error: vaultLoadingError,
        },
        balances: {
          balances: getBalances(balances),
          isLoading: balancesLoading,
          error: vaultBalanceError,
        },
        optimisticallyUpdateVaultStaked,
        refreshVaultBalance: fetchVaultBalance,
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

  const activeVaultGroup = vaultGroups.vaultGroups.find((vaultGroup) => {
    return vaultGroup.id === vaultId;
  });

  const activeVault = activeVaultGroup?.vaults.find(
    ({ isActive }) => !!isActive
  );

  return {
    ...rest,
    vaultGroups,
    vaultGroup: activeVaultGroup,
    activeVault,
  };
};
