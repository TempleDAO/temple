import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Link } from 'react-router-dom';

import Loader from 'components/Loader/Loader';
import { useListCoreVaults } from 'hooks/graphql/use-core-vaults';

const VaultListPage = () => {
  const { vaults, isLoading, error } = useListCoreVaults();

  if (isLoading) {
    return <Loader />;
  }

  if (!vaults.length) {
    return <>No Vaults</>
  }

  if (vaults.length === 1) {
    return (
      <Navigate replace to={`/core/dapp/vaults/${vaults[0].id}/summary`} />
    );
  }

  return (
    <>
      {vaults.map((vault: any) => (
        <Link to={`/core/dapp/vaults/${vault.id}/summary`}>
          {vault.name}
        </Link>
      ))}
    </>
  );
};

export default VaultListPage;
