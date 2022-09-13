import { useParams, Outlet, Link } from 'react-router-dom';

import { VaultSVG } from 'components/Vault/VaultSVG';
import { Spinner } from 'components/LoaderVault/Spinner';
import { CenterScreenWrapper } from 'components/Pages/Core/styles';
import { useVaultContext, VaultContextProvider } from './VaultContext';

const VaultPage = () => {
  const { vaultId } = useParams();
  const { isLoading, vaultGroup, error } = useVaultContext();

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
        <Link to="/dapp/vaults">
          Go To Vaults
        </Link>
      </CenterScreenWrapper>
    )
  }

  return (
    <CenterScreenWrapper>
      <VaultSVG>
        <Outlet />
      </VaultSVG>
    </CenterScreenWrapper>
  );
};

export default VaultPage;
