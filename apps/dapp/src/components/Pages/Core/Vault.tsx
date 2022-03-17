import { useState, useEffect } from 'react';
import { Routes, Route, useParams, Outlet } from 'react-router-dom';
import styled from 'styled-components';

import { Claim } from './VaultPages/Claim';
import { Stake } from './VaultPages/Stake';
import { Summary } from './VaultPages/Summary';
import { Strategy } from './VaultPages/Strategy';
import { Timing } from './VaultPages/Timing';
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
    return <div>'loading'</div>;
  }

  if (!data || error) {
    return <div>'something went wrong'</div>;
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
