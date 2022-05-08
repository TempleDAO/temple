import { createContext, FC, useEffect, useContext } from 'react';

import { VaultGroup, Vault } from 'components/Vault/types';
import { useVaultGroupBalances, VaultGroupBalance } from 'hooks/core/use-vault-group-token-balance';
import { asyncNoop } from 'utils/helpers';
import { Nullable } from 'types/util';

interface VaultContextType {
  vaultGroup: Nullable<VaultGroup>;
  activeVault: Nullable<Vault>;
  balances: VaultGroupBalance;
  refreshVaultBalance: (address: string) => Promise<void>,
}

export const VaultContext = createContext<VaultContextType>({
  balances: {},
  refreshVaultBalance: asyncNoop,
  vaultGroup: null,
  activeVault: null,
});

interface Props {
  vaultGroup: VaultGroup;
}

export const VaultContextProvider: FC<Props> = ({ children, vaultGroup }) => {
  const { balances, fetchVaultBalance: refetchVaultBalance } = useVaultGroupBalances([vaultGroup]);
  const activeVault = vaultGroup.vaults.find(({ isActive }) => isActive)!;

  useEffect(() => {
    if (!activeVault) {
      console.error(`VaultGroupError: There is no currently active vault for VaultGroup: ${vaultGroup.id}.`);
    }
  }, [activeVault]);

  return (
    <VaultContext.Provider
      value={{
        balances: balances[vaultGroup.id] || {},
        refreshVaultBalance: refetchVaultBalance,
        vaultGroup,
        activeVault,
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