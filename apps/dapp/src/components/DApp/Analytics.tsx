import React, { FC } from 'react';
import styled from 'styled-components';
import { Card } from 'components/DApp/Card';
import { PriceChart } from 'components/Charts/PriceChart';
import useRefreshableDashboardMetrics from 'hooks/use-refreshable-dashboard-metrics';
import { formatNumber, formatMillions } from 'utils/formatter';

export const Analytics: FC = () => {
  const dashboardMetrics = useRefreshableDashboardMetrics();

  return (
    <Container>
      <CardsContainer>
        <Card
          label="apy"
          value={`${formatNumber(dashboardMetrics?.templeApy || 0)}%`}
        />
        <Card
          label="IV"
          value={`$${formatNumber(dashboardMetrics?.iv || 0)}`}
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
  background-color: ${(props) => props.theme.palette.dark};
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
  padding: 0 15px;
`;
