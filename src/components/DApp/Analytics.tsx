//@ts-nocheck
import React, { FC, useEffect } from 'react';
import styled from 'styled-components';
import { Card } from 'components/DApp/Card';
// import { DataCard } from 'components/DataCard/DataCard';
import { PriceChart } from 'components/Charts/PriceChart';
import useRefreshableDashboardMetrics from 'hooks/use-refreshable-dashboard-metrics';
import {
  formatNumber,
  formatMillions,
  // formatNumberWithCommas,
} from 'utils/formatter';
// import useRefreshableAccountMetrics from 'hooks/use-refreshable-account-metrics';
import { useWallet } from 'providers/WalletProvider';

export const Analytics: FC = () => {
  const { wallet, balance, exitQueueData } = useWallet();
  // const accountMetrics = useRefreshableAccountMetrics(wallet);
  const dashboardMetrics = useRefreshableDashboardMetrics();
  // const walletValue =
  //   accountMetrics?.templeBalance * accountMetrics?.templeValue;
  // const exitQueueValue =
  //   exitQueueData?.totalTempleOwned * accountMetrics?.templeValue;
  // const ogTempleWalletValue = balance?.ogTemple * accountMetrics?.ogTemplePrice;
  // const lockedOGTempleValue =
  //   balance?.ogTempleLocked * accountMetrics?.ogTemplePrice;

  // const netWorth =
  //   lockedOGTempleValue + walletValue + ogTempleWalletValue + exitQueueValue;

  return (
    <Container>
      {/* <CardsContainer>
        <DataCard
          title={`Net Worth`}
          data={`$${formatNumberWithCommas(netWorth) || '-'}`}
          small
        />
        <DataCard
          title={`Staked`}
          data={`$OGT ${formatNumberWithCommas(balance?.ogTemple || 0)}`}
          small
        />
        <DataCard
          title={`Exit Queue`}
          data={`$T ${formatNumberWithCommas(
            exitQueueData?.totalTempleOwned || 0
          )}`}
          small
        />
        <DataCard
          title={`Wallet`}
          data={`$T ${formatNumberWithCommas(
            accountMetrics?.templeBalance || 0
          )}`}
          small
        />
      </CardsContainer> */}
      <CardsContainer>
        <Card
          label="apy"
          value={`${formatNumber(dashboardMetrics?.templeApy || 0)}%`}
        />
        <Card
          label="IV"
          value={`${formatNumber(dashboardMetrics?.iv || 0)}%`}
        />
        <Card
          label="Ratio"
          value={`${formatNumber(dashboardMetrics?.ogTempleRatio || 0)}`}
        />
        <Card
          label="Treasury"
          value={`$${formatMillions(dashboardMetrics?.treasuryValue || 0)}`}
        />
      </CardsContainer>
      <ChartContainer>
        <Frame>
          <PriceChart />
        </Frame>
      </ChartContainer>
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
`;

const CardsContainer = styled.div`
  // border: 1px solid yellow;
  display: flex;
  flex-direction: row;
  justify-content: stretch;
  margin-top: 20px;
  gap: 20px;
`;

const ChartContainer = styled.div`
  border: 1px solid #bd7b4f;
  box-sizing: border-box;
  margin-top: 20px;
  padding-bottom: 1rem;
  width: 100%;
  height: auto;
`;

const Frame = styled.div`
  height: 15.625rem;
`;
