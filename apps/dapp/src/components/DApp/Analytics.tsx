import React, { FC } from 'react';
import styled from 'styled-components';
import { Card } from 'components/DApp/Card';
import { PriceChart } from 'components/Charts/PriceChart';
import useRefreshableDashboardMetrics from 'hooks/use-refreshable-dashboard-metrics';
import { formatNumber, formatMillions } from 'utils/formatter';
import { Flex } from 'components/Layout/Flex';

export const Analytics: FC = () => {
  const dashboardMetrics = useRefreshableDashboardMetrics();

  return (
    <div>
      <Flex layout={{ kind: 'item', direction: 'row' }}>
        <Flex layout={{ kind: 'item', smallMargin: true }}>
          <Card
            label="apy"
            value={`${formatNumber(dashboardMetrics?.templeApy || 0)}%`}
          />
        </Flex>
        <Flex layout={{ kind: 'item', smallMargin: true }}>
          <Card
            label="IV"
            value={`$${formatNumber(dashboardMetrics?.iv || 0)}`}
          />
        </Flex>

        <Flex layout={{ kind: 'item', smallMargin: true }}>
          <Card
            label="Ratio"
            value={`${formatNumber(dashboardMetrics?.ogTempleRatio || 0)}`}
          />
        </Flex>

        <Flex layout={{ kind: 'item', col: 'fifth', smallMargin: true }}>
          <Card
            label="Treasury"
            value={`$${formatMillions(dashboardMetrics?.treasuryValue || 0)}`}
          />
        </Flex>
      </Flex>
      <ChartContainer>
        <Frame>
          <PriceChart />
        </Frame>
      </ChartContainer>
    </div>
  );
};

const ChartContainer = styled.div`
  border: 1px solid #bd7b4f;
  box-sizing: border-box;
  padding-bottom: 1rem;
  width: 100%;
  height: auto;
`;

const Frame = styled.div`
  height: 15.625rem;
  padding: 0 15px;
`;
