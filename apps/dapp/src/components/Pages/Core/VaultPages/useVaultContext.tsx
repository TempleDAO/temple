
import { useOutletContext } from 'react-router-dom';

import { Vault } from 'components/Vault/types';

const useVaultContext = () => {
  const { vault } = useOutletContext<{ vault: Vault }>();
  return vault;
};

export default useVaultContext;