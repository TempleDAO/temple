import React, { useEffect } from 'react';
import styled from 'styled-components';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';

import StatsCard from 'components/StatsCard/StatsCard';
import { Tabs } from 'components/Tabs/Tabs';
import type { Tab } from 'components/Tabs/Tabs';

import type { VaultGroup } from 'components/Vault/types';

import { ProfileVaults } from './components/ProfileVaults';
import { ProfileLegacyTemple } from './components/ProfileLegacyTemple';
import { ProfileDiscordData } from './components/ProfileDiscordData';
import { ProfileTransactions } from './components/ProfileTransactions';

import { phoneAndAbove } from 'styles/breakpoints';
import { theme } from 'styles/theme';

import texture1 from 'assets/images/texture-1.svg';
import texture2 from 'assets/images/texture-2.svg';
import texture3 from 'assets/images/texture-3.svg';
import texture4 from 'assets/images/texture-4.svg';
import texture5 from 'assets/images/dashboard-4.png';

import { useWallet } from 'providers/WalletProvider';
import { useFaith } from 'providers/FaithProvider';
import { useListCoreVaultGroups } from 'hooks/core/subgraph';
import { PageWrapper } from '../utils';
import { useVaultGroupBalances } from 'hooks/core/use-vault-group-token-balance';

const STAT_CARD_HEIGHT = '5rem';
const PIE_AREA_HEIGHT = '10rem';

const ProfilePage = () => {
  const { getBalance, balance, wallet } = useWallet();
  const { faith } = useFaith();
  const { isLoading, vaultGroups } = useListCoreVaultGroups();
  const { balances } = useVaultGroupBalances(vaultGroups);

  console.log(balances)
  const tabs = getTabs(
    isLoading,
    vaultGroups,
    0,
    balance.ogTemple,
    faith.lifeTimeFaith
  );

  useEffect(() => {
    getBalance();
  }, []);

  const totalStakedAcrossAllVaults = vaultGroups.reduce((total, vaultGroup) => {
    return total + vaultGroup.vaults.reduce((total, vault) => {
      return total + vault.amountStaked;
    }, 0);
  }, 0);

  return (
    <PageWrapper>
      <h3>Profile</h3>
      {wallet ? (
        <>
          {/* <ProfileOverview>
            <ProfileMeta>
              <StatsCard
                label="Stat 1"
                stat="0"
                backgroundColor={theme.palette.brand75}
                backgroundImageUrl={texture1}
                smallStatFont
                isSquare={false}
                height={STAT_CARD_HEIGHT}
              />
              <StatsCard
                label="Stat 2"
                stat="0"
                backgroundColor={theme.palette.brand75}
                backgroundImageUrl={texture2}
                smallStatFont
                isSquare={false}
                height={STAT_CARD_HEIGHT}
              />
              <StatsCard
                label="Stat 3"
                stat="0"
                backgroundColor={theme.palette.brand75}
                backgroundImageUrl={texture4}
                smallStatFont
                isSquare={false}
                height={STAT_CARD_HEIGHT}
              />
              <StatsCard
                label="Stat 4"
                stat="0"
                backgroundColor={theme.palette.brand75}
                backgroundImageUrl={texture5}
                smallStatFont
                isSquare={false}
                height={STAT_CARD_HEIGHT}
              />
              <StatsCard
                stat={`pie chart goes here`}
                heightPercentage={40}
                backgroundColor={theme.palette.brand75}
                backgroundImageUrl={texture3}
                className="stats-pie"
                smallStatFont
                isSquare={false}
                height={PIE_AREA_HEIGHT}
              />
            </ProfileMeta>
          </ProfileOverview> */}
          <Tabs tabs={tabs} />
        </>
      ) : (
        <>
          <h4>Please connect your wallet</h4>
        </>
      )}
    </PageWrapper>
  );
};

function getTabs(
  isLoading: boolean,
  vaultGroups: VaultGroup[],
  lockedOgtBalance: number,
  ogtBalance: number,
  faithBalance: number
): Tab[] {
  const tabs = [
    {
      label: 'Vaults',
      content: <ProfileVaults isLoading={isLoading} vaultGroups={vaultGroups} />,
    },
    { label: 'Transactions', content: <ProfileTransactions /> },
    { label: 'Discord', content: <ProfileDiscordData /> },
  ];

  const hasLegacyTemple = !!ogtBalance || !!lockedOgtBalance || !!faithBalance;

  if (hasLegacyTemple) {
    tabs.push({
      label: `Legacy ${TICKER_SYMBOL.TEMPLE_TOKEN}`,
      content: (
        <ProfileLegacyTemple
          lockedOgTempleBalance={lockedOgtBalance}
          ogTempleBalance={ogtBalance}
          faithBalance={faithBalance}
        />
      ),
    });
  }

  return tabs;
}

const ProfileOverview = styled.section`
  padding: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
  
  ${phoneAndAbove(`
    grid-template-columns: 1fr 1fr;
  `)}
`;

const ProfileMeta = styled.div`
  min-width: 50%;
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;

  ${phoneAndAbove(`
    padding-right: 0.75rem;
    grid-template-columns: 60% 40%;
    grid-template-rows: 1fr 1fr 2fr;
    .stats-pie {
      grid-column: 1 / -1;
    }
  `)}
`;

export default ProfilePage;
