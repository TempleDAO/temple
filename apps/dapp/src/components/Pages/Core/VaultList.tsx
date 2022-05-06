import { Navigate } from 'react-router-dom';
import { Link } from 'react-router-dom';

import Loader from 'components/Loader/Loader';
import { useListCoreVaultGroups } from 'hooks/core/subgraph';
import { CenterScreenWrapper } from 'components/Pages/Core/styles';

const VaultListPage = () => {
  const { vaultGroups, isLoading, error } = useListCoreVaultGroups();

  if (isLoading) {
    return (
      <CenterScreenWrapper>
        <Loader />
      </CenterScreenWrapper>
    );
  }

  if (error) {
    console.error(error)
    return (
      <CenterScreenWrapper>
        <h2>Something went wrong...</h2>
      </CenterScreenWrapper>
    );
  }

  if (!vaultGroups.length) {
    return (
      <CenterScreenWrapper>
        <h2>There currently are no vaults.</h2>
      </CenterScreenWrapper>
    );
  }

  if (vaultGroups.length === 1) {
    return (
      <Navigate replace to={`/core/dapp/vaults/${vaultGroups[0].id}/summary`} />
    );
  }

  return (
    <CenterScreenWrapper>
      {vaultGroups.map((vaultGroup) => (
        <li key={vaultGroup.id}>
          <Link to={`/core/dapp/vaults/${vaultGroup.id}/summary`}>
            {vaultGroup.id}
          </Link>
        </li>
      ))}
    </CenterScreenWrapper>
  );
};

export default VaultListPage;
