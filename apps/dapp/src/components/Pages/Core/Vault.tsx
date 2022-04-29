import { useParams, Outlet } from 'react-router-dom';
import styled from 'styled-components';

import { VaultSVG } from 'components/Vault/VaultSVG';
import { Spinner } from 'components/LoaderVault/Spinner';
import { useGetVaultGroup } from 'hooks/core/subgraph';

const VaultPage = () => {
  const { vaultId } = useParams();
  const { isLoading, vault, error } = useGetVaultGroup(vaultId || '');

  if (isLoading) {
    return <Spinner />;
  }

  if (!vault || error) {
    return <div>Something went wrong</div>;
  }

  return (
    <>
      <Wrapper>
        <VaultSVG data={vault}>
          <Outlet context={{ vault }} />
        </VaultSVG>
      </Wrapper>
    </>
  );
};

const Wrapper = styled.div`
  display: flex;
`;

export default VaultPage;
