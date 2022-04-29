import { useOutletContext } from 'react-router-dom';

import { VaultGroup } from 'components/Vault/types';

const useVaultContext = () => {
  const { vault } = useOutletContext<{ vault: VaultGroup }>();
  return vault;
};

export default useVaultContext;