import React, { FC } from 'react';
import styled from 'styled-components';
import { Card } from 'components/DApp/Card';
import { PriceChart } from 'components/Charts/PriceChart';
import useRefreshableDashboardMetrics from 'hooks/use-refreshable-dashboard-metrics';
import { formatNumber, formatMillions } from 'utils/formatter';
import Tooltip from 'components/Tooltip/Tooltip';

export const Analytics: FC = () => {
  const dashboardMetrics = useRefreshableDashboardMetrics();

  return (
    <Container>
      <CardsContainer>
        <Tooltip content="APY (or Annual Percentage Yield) is the theoretical yield for your staked $TEMPLE if compounded daily at the current EPY (Epoch Percentage Yield) for one year.">
          <Card
            label="apy"
            value={`${formatNumber(dashboardMetrics?.templeApy || 0)}%`}
          />
        </Tooltip>
        <Tooltip content="RFV (or Risk-free Value) is the total claimable amount of value for each $TEMPLE token if TempleDAO were to distribute all its Treasury assets to the token holders.">
          <Card
            label="RFV"
            value={`$${formatNumber(dashboardMetrics?.templeRFV || 0)}`}
          />
        </Tooltip>
        <Tooltip
          content="
Ratio (or OGT Ratio) is the amount of $TEMPLE tokens a user can claim per $OGTEMPLE token. This ratio only increases over time, compounded daily by a percentage called the EPY (epoch percentage yield)."
        >
          <Card
            label="Ratio"
            value={`${formatNumber(dashboardMetrics?.ogTempleRatio || 0)}`}
          />
        </Tooltip>
        <Tooltip content="The treasury (or reserve) are the assets that back the TEMPLE token ($TEMPLE).">
          <Card
            label="Treasury"
            value={`$${formatMillions(dashboardMetrics?.treasuryValue || 0)}`}
          />
        </Tooltip>
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
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1.5fr;
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
