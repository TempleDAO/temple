//@ts-nocheck
import React, { FC } from 'react';
import styled from 'styled-components';
import { Card } from 'components/DApp/Card';
import { PriceChart } from 'components/Charts/PriceChart';
import useRefreshableDashboardMetrics from 'hooks/use-refreshable-dashboard-metrics';
import { formatNumber } from 'utils/formatter';

export const Analytics: FC = () => {
  const dashboardMetrics = useRefreshableDashboardMetrics();

  return (
    <Container>
      <CardsContainer>
        <Card
          label="price"
          value={`$${formatNumber(dashboardMetrics?.templeValue)}`}
        />
        <Card
          label="apy"
          value={`${formatNumber(dashboardMetrics?.templeApy)}%`}
        />
        <Card label="IV" value={`${formatNumber(dashboardMetrics?.iv)}%`} />
        <Card
          label="Ratio"
          value={`${formatNumber(dashboardMetrics?.ogTempleRatio)}`}
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
  flex-wrap: wrap;
  flex-basis: 477px;
  flex-grow: 1;
  width: 50rem;
  height: 100%;
  gap: 5px 0px;
  justify-content: space-between;
`;

const CardsContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
`;

const ChartContainer = styled.div`
  border: 1px solid #bd7b4f;
  box-sizing: border-box;
  padding-bottom: 1rem;
  width: 100%;
  height: auto;
`;

const Frame = styled.div`
  height: 15.625rem;
`;
