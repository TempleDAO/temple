import { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

import { VaultGroup } from 'components/Vault/types';

const useVaultContext = () => {
  const { vault: vaultGroup } = useOutletContext<{ vault: VaultGroup }>();
  const activeVault = vaultGroup.vaults.find((vault) => vault.entries.find((entry) => entry.inZone));

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