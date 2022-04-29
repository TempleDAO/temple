import { Navigate } from 'react-router-dom';
import { Link } from 'react-router-dom';

import Loader from 'components/Loader/Loader';
import { useListCoreVaultGroups } from 'hooks/core/subgraph';

const VaultListPage = () => {
  const { vaults, isLoading, error } = useListCoreVaultGroups();

  if (isLoading) {
    return <Loader />;
  }

  if (error) {
    return <>Something went wrong...</>;
  }

  if (!vaults.length) {
    return <>There currently are no vaults.</>;
  }

  if (vaults.length === 1) {
    return (
      <Navigate replace to={`/core/dapp/vaults/${vaults[0].id}/summary`} />
    );
  }

  return (
    <ul>
      {vaults.map((vaultGroup) => (
        <li key={vaultGroup.id}>
          <Link to={`/core/dapp/vaults/${vaultGroup.id}/summary`}>
            {vaultGroup.id}
          </Link>
        </li>
      ))}
    </ul>
  );
};

export default VaultListPage;
