import { useState, useEffect } from 'react';
import { useParams, Outlet } from 'react-router-dom';
import styled from 'styled-components';

import Loader from 'components/Loader/Loader';
import { VaultSVG } from 'components/Vault/VaultSVG';
import { Vault } from 'components/Vault/types';

const oneDay = 1000 * 60 * 60 * 24;
const now = new Date(Date.now());
const oneWeekAgo = new Date(now.getTime() - (oneDay * 7));
const twoWeeksAgo = new Date(now.getTime() - (oneDay * 7 * 2));
const yesterday = new Date(now.getTime() - (oneDay));

const vaultData: { [key: string]: Vault } = {
  abc: {
    id: 'abc',
    months: 3,
    now: now,
    startDate: twoWeeksAgo,
    entries: [
      {
        id: 1,
        entryDate: now,
        amount: 5300,
      },
      {
        id: 2,
        entryDate: oneWeekAgo,
        amount: 2500,
      },
      {
        id: 2,
        entryDate: yesterday,
        amount: 2500,
      }
    ],
  },
};

const useMockVaultData = (id: string) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setIsLoading(false);
    }, 1500);
  }, [setIsLoading]);

  return { isLoading, data: vaultData[id], error: !vaultData[id] };
}

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
