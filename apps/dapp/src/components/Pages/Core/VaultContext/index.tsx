import { createContext, FC, useEffect, useContext } from 'react';
import { BigNumber } from 'ethers';

import { VaultGroup, Vault } from 'components/Vault/types';
import { useVaultGroupBalances, Operation, VaultGroupBalances } from 'hooks/core/use-vault-group-token-balance';
import { asyncNoop, noop } from 'utils/helpers';
import { Nullable } from 'types/util';

interface VaultContextType {
  vaultGroup: Nullable<VaultGroup>;
  activeVault: Nullable<Vault>;
  balances: VaultGroupBalances;
  refreshVaultBalance: (address: string) => Promise<void>,
  optimisticallyUpdateVaultStaked: (address: string, operation: Operation, amount: BigNumber) => void;
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
    fetchVaultBalance,
    optimisticallyUpdateVaultStaked: updateStakedAmount,
  } = useVaultGroupBalances([vaultGroup]);

  const activeVault = vaultGroup.vaults.find(({ isActive }) => isActive)!;

  useEffect(() => {
    if (!activeVault) {
      console.error(`VaultGroupError: There is no currently active vault for VaultGroup: ${vaultGroup.id}.`);
    }
  }, [activeVault]);

  const optimisticallyUpdateVaultStaked =
    (vaultAddress: string, operation: Operation, amount: BigNumber) => updateStakedAmount(
      vaultAddress,
      operation,
      amount,
    );

  const getBalances = (balances: VaultGroupBalances, vaultGroup: VaultGroup) => {
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