import { Navigate } from 'react-router-dom';
import { Link } from 'react-router-dom';

import Loader from 'components/Loader/Loader';
import { useListCoreVaultGroups } from 'hooks/core/subgraph';
import { CenterScreenWrapper } from 'components/Pages/Core/styles';
import { SubgraphError } from 'hooks/core/types';

const VaultListPage = () => {
  const { vaultGroups, isLoading, error } = useListCoreVaultGroups();

  if (isLoading) {
    return (
      <CenterScreenWrapper>
        <Loader />
      </CenterScreenWrapper>
    );
  }

  let errorMessage = 'Something went wrong...';

  if (error) {
    console.error(error);
    if (error instanceof SubgraphError) {
      errorMessage = 'Subgraph Unavailable. Please try again later.';
    }

    return (
      <CenterScreenWrapper>
        <h2>{errorMessage}</h2>
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
      <Navigate replace to={`/dapp/vaults/${vaultGroups[0].id}/summary`} />
    );
  }

  return (
    <CenterScreenWrapper>
      {vaultGroups.map((vaultGroup) => (
        <li key={vaultGroup.id}>
          <Link to={`/dapp/vaults/${vaultGroup.id}/summary`}>
            {vaultGroup.id}
          </Link>
        </li>
      ))}
    </CenterScreenWrapper>
  );
};

export default VaultListPage;
