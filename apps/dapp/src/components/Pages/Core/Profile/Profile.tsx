import { useEffect, useMemo } from 'react';
import styled from 'styled-components';

import StatsCard from 'components/StatsCard/StatsCard';

import { ProfileVaults } from './components/ProfileVaults';
import { ProfileLegacyTemple } from './components/ProfileLegacyTemple';

import { phoneAndAbove } from 'styles/breakpoints';
import { theme } from 'styles/theme';

import texture1 from 'assets/images/texture-1.svg';
import texture2 from 'assets/images/texture-2.svg';
import texture3 from 'assets/images/texture-3.svg';
import texture4 from 'assets/images/texture-4.svg';
import texture5 from 'assets/images/dashboard-4.png';
import { curveCatmullRom } from 'd3-shape';

import { useWallet } from 'providers/WalletProvider';
import { useFaith } from 'providers/FaithProvider';
import { useListCoreVaultGroups, createUserTransactionsQuery } from 'hooks/core/subgraph';
import { PageWrapper } from '../utils';
import { useVaultGroupBalances } from 'hooks/core/use-vault-group-token-balance';
import { FlexibleXYPlot, XAxis, YAxis, LineSeries, Crosshair } from 'react-vis';
import { useSubgraphRequest } from 'hooks/use-subgraph-request';
import env from 'constants/env';
import { Nullable } from 'types/util';

const STAT_CARD_HEIGHT = '5rem';
const PIE_AREA_HEIGHT = '10rem';

interface Transaction {
  id: string;
  timestamp: string;
  amount: string;
}

interface TransactionResponse {
  data?: {
    user: Nullable<{
      deposits: Transaction[];
      withdraws: Transaction[];
    }>;
  }
}

const ProfilePage = () => {
  const { getBalance, wallet, balance } = useWallet();
  const { faith } = useFaith();
  const { isLoading: vaultGroupsLoading, vaultGroups } = useListCoreVaultGroups();
  const { balances, isLoading: vaultGroupBalancesLoading } = useVaultGroupBalances(vaultGroups);
  const [fetchTransactions, { response, isLoading: depositsLoading, error }] = useSubgraphRequest<TransactionResponse>(
    env.subgraph.templeCore,
    createUserTransactionsQuery(wallet || ''),
  );

  useEffect(() => {
    if (!wallet) {
      return;
    }
    fetchTransactions().catch((err) =>{
      console.log('err =>', err);
    })
  }, [fetchTransactions, wallet]);

  useEffect(() => {
    if (!wallet) {
      return;
    }
    getBalance();
  }, [wallet]);

  const totalStakedAcrossAllVaults = Object.values(balances).reduce((total, vault) => {
    return total + (vault?.staked || 0);
  }, 0);

  const totalBalancesAcrossVaults = Object.values(balances).reduce((balance, vault) => {
    return balance + (vault.balance || 0);
  }, 0);

  const claimableVaults = new Set(vaultGroups.flatMap((vaultGroup) => {
    return vaultGroup.vaults.filter(({ unlockDate }) => unlockDate === 'NOW').map(({ id }) => id);
  }));

  const claimableBalance = Object.entries(balances).reduce((total, [address, vault]) => {
    if (!claimableVaults.has(address)) {
      return total;
    }

    return total + (vault.balance || 0)
  }, 0);

  const isLoading = vaultGroupsLoading || vaultGroupBalancesLoading;
  const totalEarned = totalBalancesAcrossVaults - totalStakedAcrossAllVaults;
  const lockedOGTempleBalance = balance.ogTempleLockedClaimable;
  const ogTempleBalance = balance.ogTemple;
  const faithBalance = faith.lifeTimeFaith;
  const hasLegacyTemple = !!ogTempleBalance || !!lockedOGTempleBalance || !!faithBalance;

  const user = response?.data?.user;
  const mergedTransactions = useMemo(() => {
    if (!user) {
      return [];
    }
    // const withdraws
    const merged = [...user.deposits.map((deposit) => ({
      type: 'deposit',
      amount: Number(deposit.amount),
      timestamp: new Date(Number(deposit.timestamp) * 1000),
      id: deposit.id,
    })),
    ...user.withdraws.map((withdraw) => ({
      type: 'withdraw',
      amount: Number(withdraw.amount),
      timestamp: new Date(Number(withdraw.timestamp) * 1000),
      id: withdraw.id,
    }))];

    return merged.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [user]);
  console.log('merged', mergedTransactions)
  const data = mergedTransactions.reduce<{ y: number; x: number, d: Date, }[]>((acc, transaction) => {
    const lastBalance = acc[acc.length - 1]?.y || 0;
    const nextBalance = transaction.type === 'deposit' ? lastBalance + transaction.amount : lastBalance - transaction.amount;

    acc.push({
      d: transaction.timestamp,
      x: transaction.timestamp.getTime(),
      y: nextBalance,
    });

    return acc;
  }, []);

  const now = new Date(Date.now());

  data.push({
    d: now,
    x: now.getTime(),
    y: totalBalancesAcrossVaults,
  });

  const largest = [...data].sort((a, b) => b.y - a.y)[0]?.y || 0;
  console.log(largest)
  const largestBalance = largest + 500;
  const yDomain = [0, largestBalance];
  const xDomain = [data[0]?.x || 0, now.getTime()];

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
              {/* <StatsCard
                stat={`pie chart goes here`}
                heightPercentage={40}
                backgroundColor={theme.palette.brand75}
                backgroundImageUrl={texture3}
                className="stats-pie"
                smallStatFont
                isSquare={false}
              /> */}
              <FlexibleXYPlot
                xType="time"
                xDomain={xDomain}
                yDomain={yDomain}
                margin={{left: 70}}
                height={250}
              >
                <XAxis
                  style={{
                    line: { stroke: '#2b2a2d' },
                    ticks: { stroke: '#6b6b76' },
                    text: {
                      stroke: 'none',
                      fill: '#6b6b76',
                      fontSize: 10,
                    },
                  }}
                  tickTotal={data.length}
                />
                <YAxis
                  style={{
                    line: { stroke: '#2b2a2d' },
                    ticks: { stroke: '#6b6b76' },
                    text: { stroke: 'none', fill: '#6b6b76', fontWeight: 600 },
                  }}
                  tickFormat={(v) => `${v} $T`}
                />
                <LineSeries
                  data={data}
                  color="#696766"
                  //@ts-ignore
                  strokeWidth={2}
                  onNearestX={(...args: any[]) => {
                    console.log(...args);
                  }}
                />
              </FlexibleXYPlot>
            </ProfileMeta>
          </ProfileOverview>
          <SectionWrapper>
            <ProfileVaults
              isLoading={isLoading}
              vaultGroupBalances={balances}
              vaultGroups={vaultGroups}
            />
          </SectionWrapper>
          {hasLegacyTemple && (
            <SectionWrapper>
              <ProfileLegacyTemple
                lockedOgTempleBalance={lockedOGTempleBalance}
                ogTempleBalance={ogTempleBalance}
                faithBalance={faithBalance}
              />
            </SectionWrapper>
          )}
        </>
      ) : (
        <>
          <h4>Please connect your wallet...</h4>
        </>
      )}
    </PageWrapper>
  );
};

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

const SectionWrapper = styled.div`
  margin-bottom: 1rem;
`;

export default ProfilePage;
