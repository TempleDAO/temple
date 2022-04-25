import { useState, useEffect } from 'react';
import { useParams, Outlet } from 'react-router-dom';
import styled from 'styled-components';

import { VaultSVG } from 'components/Vault/VaultSVG';
import { Vault } from 'components/Vault/types';
import { Spinner } from 'components/LoaderVault/Spinner';
import { VAULT_CONTRACT_INFO } from 'constants/core';

const vaultData: { [key: string]: Vault } = {
  ['0x1d3591a131f6C1951dae5a4dE3AfEF0Fc1d63e64']: {
    id: '0x1d3591a131f6C1951dae5a4dE3AfEF0Fc1d63e64',
    months: 3,
    tvl: 12000050,
    now: new Date('6/15/22'),
    startDate: new Date('4/1/22'),
    entries: [],
    // entries: [
    //   {
    //     id: 1,
    //     entryDate: new Date('4/1/2022'),
    //     amount: 5300,
    //   },
    //   {
    //     id: 2,
    //     entryDate: new Date('5/30/2022'),
    //     amount: 2500,
    //   },
    // ],
  },
};

export const useMockVaultData = (id: string) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setIsLoading(false);
    }, 750);
  }, [setIsLoading]);

  return { isLoading, data: vaultData[id], error: !vaultData[id] };
};

const VaultPage = () => {
  const { vaultId } = useParams();
  const { isLoading, data, error } = useMockVaultData(vaultId || '');

  if (isLoading) {
    return <Spinner />;
  }

  if (!data || error) {
    return <div>Something went wrong</div>;
  }

  return (
    <>
      <Wrapper>
        <VaultSVG data={data}>
          <Outlet context={{ vault: data }} />
        </VaultSVG>
      </Wrapper>
    </>
  );
};

const Wrapper = styled.div`
  display: flex;
`;

export default VaultPage;
