import { useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';

import { VaultGroup } from 'components/Vault/types';

const useVaultContext = () => {
  const { vaultGroup } = useOutletContext<{ vaultGroup: VaultGroup }>();
  const activeVault = vaultGroup.vaults.find(({ isActive }) => isActive);

  useEffect(() => {
    if (!activeVault) {
      console.error(`VaultGroupError: There is no currently active vault for VaultGroup: ${vaultGroup.id}.`);
    }
  }, [activeVault]);

  return {
    vaultGroup,
    activeVault: activeVault!,
  };
};

export default useVaultContext;