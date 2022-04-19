import { useOutletContext } from 'react-router-dom';

import { Vault } from 'components/Vault/types';

const useVaultContext = () => {
  const x = useOutletContext<{ vault: Vault; target: any; }>();
  console.log(x);
  return x || {};
};

export default useVaultContext;