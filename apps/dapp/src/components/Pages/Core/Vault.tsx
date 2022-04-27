import { useState, useEffect } from 'react';
import { useParams, Outlet } from 'react-router-dom';
import styled from 'styled-components';

import { VaultSVG } from 'components/Vault/VaultSVG';
import { Vault } from 'components/Vault/types';
import { Spinner } from 'components/LoaderVault/Spinner';
import { VAULT_CONTRACT_INFO } from 'constants/core';
import { useGetCoreVault } from 'hooks/core/subgraph';

const ENV = import.meta.env;

export const vaultData: { [key: string]: Vault } = {
  [ENV.VITE_PUBLIC_TEMPLE_VAULT_5_MIN]: {
    id: ENV.VITE_PUBLIC_TEMPLE_VAULT_5_MIN,
    months: 3,
    tvl: 12000050,
    now: new Date('6/15/22'),
    startDate: new Date('4/1/22'),
    entries: [
      {
        id: 1,
        entryDate: new Date('4/1/2022'),
        amount: 5300,
      },
      {
        id: 2,
        entryDate: new Date('5/30/2022'),
        amount: 2500,
      },
    ],
  },
};

const VaultPage = () => {
  const { vaultId } = useParams();
  const { isLoading, vault, error } = useGetCoreVault(vaultId || '');

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
