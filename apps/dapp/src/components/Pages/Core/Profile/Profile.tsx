import React, { useEffect } from 'react';
import styled from 'styled-components';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';

import StatsCard from 'components/StatsCard/StatsCard';
import { Tabs } from 'components/Tabs/Tabs';
import type { Tab } from 'components/Tabs/Tabs';

import { tabletAndAbove } from 'styles/breakpoints';
import { theme } from 'styles/theme';

import texture1 from 'assets/images/texture-1.svg';
import texture2 from 'assets/images/texture-2.svg';
import texture3 from 'assets/images/texture-3.svg';
import texture4 from 'assets/images/texture-4.svg';

import texture5 from 'assets/images/dashboard-4.png';
import { useWallet } from 'providers/WalletProvider';
import { useFaith } from 'providers/FaithProvider';

const STAT_CARD_HEIGHT = '5rem';
const PIE_AREA_HEIGHT = '10rem';

const ProfilePage = () => {
  const { getBalance, balance } = useWallet();
  const { faith } = useFaith();

  const tabs = getTabs(
    balance.ogTempleLocked,
    balance.ogTemple,
    faith.lifeTimeFaith
  );

  useEffect(() => {
    getBalance();
  }, []);

  return (
    <>
      <Heading>Profile</Heading>
      <ProfileOverview>
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
      </ProfileOverview>

      <Tabs tabs={tabs} />
    </>
  );
};

function getTabs(
  lockedOgtBalance: number,
  ogtBalance: number,
  faithBalance: number
): Tab[] {
  const tabs = [
    { label: 'Vaults', content: <Subheading>Vaults</Subheading> },
    { label: 'Transactions', content: <Subheading>Transactions</Subheading> },
    { label: 'Discord', content: <Subheading>Discord</Subheading> },
  ];

  const hasLegacyTemple = !!ogtBalance || !!lockedOgtBalance || !!faithBalance;

  if (hasLegacyTemple) {
    tabs.push({
      label: `Legacy ${TICKER_SYMBOL.TEMPLE_TOKEN}`,
      content: (
        <Subheading>{`Legacy ${TICKER_SYMBOL.TEMPLE_TOKEN}`}</Subheading>
      ),
    });
  }

  return tabs;
}

const Heading = styled.h2`
  ${({ theme }) => theme.typography.h2};
  margin: 0;
`;

const Subheading = styled.h3`
  ${({ theme }) => theme.typography.h4};
  margin: 0;
`;

const ProfileOverview = styled.section`
  padding: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
  ${tabletAndAbove(`
    grid-template-columns: 1fr 1fr;
  `)}
`;

const ProfileMeta = styled.div`
  min-width: 50%;
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
  padding-right: 0.75rem;
  ${tabletAndAbove(`
    grid-template-columns: 60% 40%;
    grid-template-rows: 1fr 1fr 2fr;
    .stats-pie {
      grid-column: 1 / -1;
    }
  `)}
`;

export default ProfilePage;
