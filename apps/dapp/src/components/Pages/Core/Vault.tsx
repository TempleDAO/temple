import { useState, useEffect } from 'react';
import { useParams, Outlet } from 'react-router-dom';
import styled from 'styled-components';

import Loader from 'components/Loader/Loader';
import { VaultSVG } from 'components/Vault/VaultSVG';
import { Vault } from 'components/Vault/types';


const vaultData: { [key: string]: Vault } = {
  abc: {
    id: 'abc',
    months: 3,
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
    return <Loader />;
  }

  if (!data || error) {
    return <div>Something went wrong</div>;
  }

  return (
    <Wrapper>
      <VaultSVG data={data}>
        <Outlet context={{ vault: data }} />
      </VaultSVG>
    </Wrapper>
  );
};

const Wrapper = styled.div`
  display: flex;
`;

export default VaultPage;
