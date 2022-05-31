import { useParams, Outlet, Link } from 'react-router-dom';

import { VaultSVG } from 'components/Vault/VaultSVG';
import { Spinner } from 'components/LoaderVault/Spinner';
import { useGetVaultGroup } from 'hooks/core/subgraph';
import { CenterScreenWrapper } from 'components/Pages/Core/styles';
import { VaultContextProvider } from './VaultContext';

const VaultPage = () => {
  const { vaultId } = useParams();
  const { isLoading, vaultGroup, error } = useGetVaultGroup(vaultId || '');

  if (isLoading) {
    return (
      <CenterScreenWrapper>
        <Spinner />
      </CenterScreenWrapper>
    );
  }

  if (error) {
    console.error(error);
    return (
      <CenterScreenWrapper>
        <h2>Something went wrong</h2>
      </CenterScreenWrapper>
    );
  }

  if (!vaultGroup) {
    return (
      <CenterScreenWrapper>
        <h2>Invalid Vault.</h2>
        <Link to="/core/dapp/vaults">
          Go To Vaults
        </Link>
      </CenterScreenWrapper>
    )
  }

  return (
    <VaultContextProvider vaultGroup={vaultGroup}>
      <CenterScreenWrapper>
        <VaultSVG>
          <Outlet />
        </VaultSVG>
      </CenterScreenWrapper>
    </VaultContextProvider>
  );
};

export default VaultPage;
