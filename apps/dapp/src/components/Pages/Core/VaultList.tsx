import { Navigate } from 'react-router-dom';
import { Link } from 'react-router-dom';

import { useVaultsContext } from 'components/VaultsProvider';
import Loader from 'components/Loader/Loader';

const VaultListPage = () => {
  const { vaults, isLoading } = useVaultsContext();

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
      {vaults.map((vault) => (
        <Link to={`/core/dapp/vaults/${vault.id}/summary`}>
          {vault.name}
        </Link>
      ))}
    </>
  );
};

export default VaultListPage;
