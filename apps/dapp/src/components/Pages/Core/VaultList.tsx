import { Navigate } from 'react-router-dom';
import { vaultData } from './Vault';

const VaultListPage = () => {
  const firstVault = Object.values(vaultData)[0];
  return (
    <Navigate replace to={`/core/dapp/vaults/${firstVault.id}/summary`} />
  );
};

export default VaultListPage;
