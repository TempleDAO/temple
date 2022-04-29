import { useParams, Outlet, Link } from 'react-router-dom';
import styled from 'styled-components';

import { VaultSVG } from 'components/Vault/VaultSVG';
import { Spinner } from 'components/LoaderVault/Spinner';
import { useGetVaultGroup } from 'hooks/core/subgraph';
import { CenterScreenWrapper } from 'components/Pages/Core/styles';

const VaultPage = () => {
  const { vaultId } = useParams();
  const { isLoading, vault, error } = useGetVaultGroup(vaultId || '');

  if (isLoading) {
    return (
      <CenterScreenWrapper>
        <Spinner />
      </CenterScreenWrapper>
    );
  }

  if (error) {
    return (
      <CenterScreenWrapper>
        <h2>Something went wrong</h2>
      </CenterScreenWrapper>
    );
  }

  if (!vault) {
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
    <>
      <CenterScreenWrapper>
        <VaultSVG data={vault}>
          <Outlet context={{ vault }} />
        </VaultSVG>
      </CenterScreenWrapper>
    </>
  );
};

const Wrapper = styled.div`
  display: flex;
`;

export default VaultPage;
