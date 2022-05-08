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
import { useVaultGroupBalances, VaultGroupBalances } from 'hooks/core/use-vault-group-token-balance';

const STAT_CARD_HEIGHT = '5rem';
const PIE_AREA_HEIGHT = '10rem';

const ProfilePage = () => {
  const { getBalance, balance, wallet } = useWallet();
  const { faith } = useFaith();
  const { isLoading: vaultGroupsLoading, vaultGroups } = useListCoreVaultGroups();
  const { balances, isLoading: vaultGroupBalancesLoading } = useVaultGroupBalances(vaultGroups);

  const tabs = getTabs(
    vaultGroupsLoading,
    vaultGroups,
    0,
    balance.ogTemple,
    faith.lifeTimeFaith,
    balances,
  );

  useEffect(() => {
    getBalance();
  }, []);

  const totalStakedAcrossAllVaults = vaultGroups.reduce((total, vaultGroup) => {
    return total + vaultGroup.vaults.reduce((total, vault) => {
      return total + vault.amountStaked;
    }, 0);
  }, 0);

  const totalBalancesAcrossVaults = Object.values(balances).reduce((balance, vaultGroup) => {
    return balance + Object.values(vaultGroup).reduce((vaultGroupBalance, vault) => {
      return vaultGroupBalance + (vault.balance || 0);
    }, 0);
  }, 0);

  const claimableVaults = new Set(vaultGroups.flatMap((vaultGroup) => {
    return vaultGroup.markers.filter(({ unlockDate }) => unlockDate === 'NOW').map(({ vaultId }) => vaultId);
  }));

  const claimableBalance = Object.values(balances).reduce((claimable, vaultGroup) => {
    const groupClaimable = Object.entries(vaultGroup).reduce((total, [address, vaultBalance]) => {
      if (!claimableVaults.has(address)) {
        return total;
      }
      return total + (vaultBalance.balance || 0);
    }, 0);
    return claimable + groupClaimable;
  }, 0);

  const isLoading = vaultGroupsLoading || vaultGroupBalancesLoading;
  const totalEarned = totalBalancesAcrossVaults - totalStakedAcrossAllVaults;

  return (
    <PageWrapper>
      <h3>Profile</h3>
      {wallet ? (
        <>
          <ProfileOverview>
            <ProfileMeta>
              <StatCards>
                <StatsCard
                  label="$Temple Deposited"
                  stat={totalStakedAcrossAllVaults}
                  backgroundColor={theme.palette.brand75}
                  backgroundImageUrl={texture1}
                  smallStatFont
                  isSquare={false}
                  height={STAT_CARD_HEIGHT}
                  className="stat"
                  isLoading={isLoading}
                />
                <StatsCard
                  label="$Temple Locked"
                  stat={totalBalancesAcrossVaults}
                  backgroundColor={theme.palette.brand75}
                  backgroundImageUrl={texture2}
                  smallStatFont
                  isSquare={false}
                  height={STAT_CARD_HEIGHT}
                  className="stat"
                  isLoading={isLoading}
                />
                <StatsCard
                  label="$Temple Earned"
                  stat={totalEarned}
                  backgroundColor={theme.palette.brand75}
                  backgroundImageUrl={texture4}
                  smallStatFont
                  isSquare={false}
                  height={STAT_CARD_HEIGHT}
                  className="stat"
                  isLoading={isLoading}
                />
                <StatsCard
                  label="$Temple Claimable"
                  stat={claimableBalance}
                  backgroundColor={theme.palette.brand75}
                  backgroundImageUrl={texture5}
                  smallStatFont
                  isSquare={false}
                  className="stat"
                  height={STAT_CARD_HEIGHT}
                  isLoading={isLoading}
                />
              </StatCards>
              <StatsCard
                stat={`pie chart goes here`}
                heightPercentage={40}
                backgroundColor={theme.palette.brand75}
                backgroundImageUrl={texture3}
                className="stats-pie"
                smallStatFont
                isSquare={false}
              />
            </ProfileMeta>
          </ProfileOverview>
          {/* <Tabs tabs={tabs} /> */}
          <ProfileVaults
            isLoading={isLoading}
            vaultGroupBalances={balances}
            vaultGroups={vaultGroups}
          />
          <ProfileTransactions />
        </>
      ) : (
        <>
          <h4>Please connect your wallet...</h4>
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
  faithBalance: number,
  vaultGroupBalances: VaultGroupBalances,
): Tab[] {
  const tabs = [
    {
      label: 'Vaults',
      content: (
        <ProfileVaults
          isLoading={isLoading}
          vaultGroupBalances={vaultGroupBalances}
          vaultGroups={vaultGroups}
        />
      ),
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
`;

const ProfileMeta = styled.div`
  min-width: 50%;
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;

  ${phoneAndAbove(`
    grid-template-columns: 1fr 1fr;
  `)}
`;

const StatCards = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 0.75rem;
`;

export default ProfilePage;
