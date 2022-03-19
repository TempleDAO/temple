import { useState, useEffect } from 'react';
import { useParams, Outlet } from 'react-router-dom';
import styled from 'styled-components';

import Loader from 'components/Loader/Loader';
import { VaultSVG } from 'components/Vault/VaultSVG';
import { Vault } from 'components/Vault/types';
import { VAULT_MONTH_MILLISECONDS } from '../../../constants';

const oneDay = 1000 * 60 * 60 * 24;
const now = new Date(Date.now());

// CurrentCycle Start (cycle 2)
const twoMonthsAgo = new Date(now.getTime() - (VAULT_MONTH_MILLISECONDS * 2));
// 3 months before current cycle start
const vaultStart = new Date(twoMonthsAgo.getTime() - (VAULT_MONTH_MILLISECONDS * 3));

const oneWeekAgo = new Date(now.getTime() - (oneDay * 7));
const oneMonthAndOneWeek = new Date(now.getTime() - (VAULT_MONTH_MILLISECONDS + oneDay * 7));

// Entry into vault 10 days before begining of current cycle.
const secondCycleEntry = new Date(twoMonthsAgo.getTime() - (oneDay * 10));

const vaultData: { [key: string]: Vault } = {
  abc: {
    id: 'abc',
    months: 3,
    now: now,
    startDate: vaultStart,
    currentCycle: 1, // zero index
    entries: [
      {
        id: 1,
        entryDate: now,
        amount: 5300,
        currentCycle: 0,
      },
      {
        id: 2,
        entryDate: oneWeekAgo,
        amount: 2500,
        currentCycle: 0,
      },
      {
        id: 3,
        entryDate: oneMonthAndOneWeek,
        amount: 2500,
        currentCycle: 0,
      },
      {
        id: 4,
        entryDate: secondCycleEntry,
        amount: 30000,
        currentCycle: 1,
      },
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
