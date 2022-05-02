import { Tabs } from 'components/Tabs/Tabs';
import { useWallet } from 'providers/WalletProvider';
import React, { useEffect } from 'react';
import styled from 'styled-components';
import { PageWrapper } from '../utils';
import { Swap } from './components/Swap';
import { Unlock } from './components/Unlock';

export const Trade = () => {
  const { balance } = useWallet();
  const hasUnlockedOgt = Boolean(balance.ogTempleLockedClaimable);

  const tabs = [
    {
      label: 'Swap',
      content: <Swap />,
    },
    {
      label: 'Unlock',
      content: <Unlock />,
    },
  ];

  return (
    <PageWrapper>
      <h3>Trade</h3>
      {hasUnlockedOgt ? <Tabs tabs={tabs} /> : <Swap />}
    </PageWrapper>
  );
};

export const Container = styled.section`
  height: 100%;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
`;
