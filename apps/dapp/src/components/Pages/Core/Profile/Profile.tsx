import { useEffect, useMemo, useRef } from 'react';
import styled from 'styled-components';
import { subDays } from 'date-fns';
import {
  FlexibleXYPlot,
  XAxis,
  YAxis,
  LineSeries,
  ChartLabel,
} from 'react-vis';
import { BigNumber } from 'ethers';

import { PageWrapper } from '../utils';
import StatsCard from 'components/Pages/Core/Profile/components/StatsCard';
import { ProfileVaults } from './components/ProfileVaults';
import { ProfileLegacyTemple } from './components/ProfileLegacyTemple';

import { phoneAndAbove } from 'styles/breakpoints';
import { theme } from 'styles/theme';

import texture1 from 'assets/images/texture-1.svg';
import texture2 from 'assets/images/texture-2.svg';
import texture5 from 'assets/images/dashboard-4.png';

import { createDateFromSeconds, formatTemple } from 'components/Vault/utils';
import { Nullable } from 'types/util';
import { fromAtto, ZERO } from 'utils/bigNumber';

import { createUserTransactionsQuery } from 'hooks/core/subgraph';
import { useWallet } from 'providers/WalletProvider';
import { useFaith } from 'providers/FaithProvider';
import { useSubgraphRequest } from 'hooks/use-subgraph-request';
import { useStaking } from 'providers/StakingProvider';
import { useVaultContext } from '../VaultContext';

import env from 'constants/env';

const STAT_CARD_HEIGHT = '5rem';

const ProfilePage = () => {
  const { getBalance, wallet } = useWallet();
  const { faith } = useFaith();
  const {
    balances: { balances, isLoading: balancesLoading },
    vaultGroups: { vaultGroups, isLoading: vaultGroupsLoading },
  } = useVaultContext();
  const { lockedEntries, updateLockedEntries } = useStaking();

  const isLoading = vaultGroupsLoading || balancesLoading;

  useEffect(() => {
    if (!wallet) {
      return;
    }
    updateLockedEntries();
    getBalance();
  }, [wallet]);

  const vaultGroupBalances = new Map(
    Object.values(balances).flatMap((vaultGroup) => Object.entries(vaultGroup))
  );
  const vaultValues = Array.from(vaultGroupBalances.values());

  const totalStakedAcrossAllVaults = vaultValues.reduce((total, vault) => {
    return total.add(vault?.staked || ZERO);
  }, BigNumber.from(0));

  const totalBalancesAcrossVaults = vaultValues.reduce((balance, vault) => {
    return balance.add(vault.balance || ZERO);
  }, BigNumber.from(0));

  const claimableVaults = new Set(
    vaultGroups.flatMap((vaultGroup) => {
      return vaultGroup.vaults
        .filter(({ unlockDate }) => unlockDate === 'NOW')
        .map(({ id }) => id);
    })
  );

  const { data, yDomain, xDomain } = useChartData(
    wallet || '',
    fromAtto(totalBalancesAcrossVaults)
  );

  const claimableBalance = Array.from(vaultGroupBalances.entries()).reduce(
    (total, [address, vault]) => {
      if (!claimableVaults.has(address)) {
        return total;
      }

      return total.add(vault.balance || ZERO);
    },
    BigNumber.from(0)
  );

  const faithBalance = faith.usableFaith;

  let lockedOGTempleBalance = BigNumber.from(0);

  if (lockedEntries.length > 0) {
    lockedOGTempleBalance = lockedEntries.reduce((acc, entry) => {
      acc = acc.add(entry.balanceOGTemple);
      return acc;
    }, lockedOGTempleBalance);
  }

  const hasLegacyTemple =
    lockedOGTempleBalance.gt(ZERO) || faithBalance.gt(ZERO);

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
                  stat={formatTemple(totalStakedAcrossAllVaults)}
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
                  stat={formatTemple(totalBalancesAcrossVaults)}
                  backgroundColor={theme.palette.brand75}
                  backgroundImageUrl={texture2}
                  smallStatFont
                  isSquare={false}
                  height={STAT_CARD_HEIGHT}
                  className="stat"
                  isLoading={isLoading}
                />
                <StatsCard
                  label="$Temple Claimable"
                  stat={formatTemple(claimableBalance)}
                  backgroundColor={theme.palette.brand75}
                  backgroundImageUrl={texture5}
                  smallStatFont
                  isSquare={false}
                  className="stat"
                  height={STAT_CARD_HEIGHT}
                  isLoading={isLoading}
                />
              </StatCards>
              <FlexibleXYPlot
                xType="time"
                dontCheckIfEmpty
                xDomain={xDomain}
                yDomain={yDomain}
                margin={{ left: 70 }}
                height={264}
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
                  tickTotal={8}
                />
                <YAxis
                  style={{
                    line: { stroke: '#2b2a2d' },
                    ticks: { stroke: '#6b6b76' },
                    text: { stroke: 'none', fill: '#6b6b76', fontWeight: 600 },
                  }}
                  tickTotal={5}
                  tickFormat={(v) => `${v} $T`}
                />
                <LineSeries
                  data={data}
                  color="#696766"
                  // @ts-ignore
                  strokeWidth={2}
                />
                {data.length === 0 && (
                  <ChartLabel
                    text="No transaction history"
                    includeMargin={false}
                    xPercent={0.5}
                    yPercent={0.5}
                    style={{
                      transform: 'translate(-50, 0)',
                    }}
                  />
                )}
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
  };
}

const useChartData = (wallet: string, totalBalance: number) => {
  const [fetchTransactions, { response }] =
    useSubgraphRequest<TransactionResponse>(
      env.subgraph.templeCore,
      createUserTransactionsQuery(wallet || '')
    );

  useEffect(() => {
    if (!wallet) {
      return;
    }
    fetchTransactions();
  }, [fetchTransactions, wallet]);

  const user = response?.data?.user;

  return useMemo(() => {
    const now = new Date(Date.now());

    if (!user) {
      return {
        data: [],
        xDomain: [subDays(now, 7).getTime(), now.getTime()],
        yDomain: [0, 5000],
      };
    }

    const merged = [
      ...user.deposits.map((deposit) => ({
        type: 'deposit',
        amount: Number(deposit.amount),
        timestamp: createDateFromSeconds(deposit.timestamp),
        id: deposit.id,
      })),
      ...user.withdraws.map((withdraw) => ({
        type: 'withdraw',
        amount: Number(withdraw.amount),
        timestamp: createDateFromSeconds(withdraw.timestamp),
        id: withdraw.id,
      })),
    ];

    const sortedByDate = merged.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
    const dataPoints = sortedByDate.reduce<{ y: number; x: number; d: Date }[]>(
      (acc, transaction) => {
        const lastBalance = acc[acc.length - 1]?.y || 0;
        const nextBalance =
          transaction.type === 'deposit'
            ? lastBalance + transaction.amount
            : lastBalance - transaction.amount;

        acc.push({
          d: transaction.timestamp,
          x: transaction.timestamp.getTime(),
          y: nextBalance,
        });

        return acc;
      },
      []
    );

    const END_OF_GRAPH_PADDING = 2 * 60 * 1000;

    dataPoints.push({
      d: new Date(now.getTime() + END_OF_GRAPH_PADDING),
      x: now.getTime() + END_OF_GRAPH_PADDING,
      y: totalBalance,
    });

    const largest = [...dataPoints].sort((a, b) => b.y - a.y)[0]?.y || 0;
    const largestBalance = largest + 500;
    const yDomain = [0, largestBalance];
    const xDomain = [
      dataPoints[0]?.x || 0,
      now.getTime() + END_OF_GRAPH_PADDING,
    ];

    return {
      data: dataPoints,
      xDomain,
      yDomain,
    };
  }, [user, totalBalance]);
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
    grid-template-columns: 1fr 2fr;
  `)}
`;

const StatCards = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
  gap: 0.75rem;
`;

const SectionWrapper = styled.div`
  margin-bottom: 1rem;
`;

export default ProfilePage;
