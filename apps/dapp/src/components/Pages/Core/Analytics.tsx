import React from 'react';
import styled from 'styled-components';

import Embed from 'components/Embed/Embed';
import StatsCard from 'components/StatsCard/StatsCard';
import { PriceChart } from 'components/Charts/PriceChart';
import { Spacer } from 'components/AMM/helpers/components';
import { theme } from 'styles/theme';
import { formatNumber, formatMillions } from 'utils/formatter';
import useRefreshableDashboardMetrics from 'hooks/use-refreshable-dashboard-metrics';
import { phoneAndAbove } from 'styles/breakpoints';

import texture1 from 'assets/images/texture-1.svg';
import texture2 from 'assets/images/texture-2.svg';
import texture3 from 'assets/images/texture-3.svg';
import texture4 from 'assets/images/texture-4.svg';

import background1 from 'assets/images/dashboard-1.png';
import background2 from 'assets/images/dashboard-2.png';
import background3 from 'assets/images/dashboard-3.png';
import background4 from 'assets/images/dashboard-4.png';

import background9 from 'assets/images/dashboard-9.png';
import background10 from 'assets/images/dashboard-10.png';
import background11 from 'assets/images/dashboard-11.png';

import chaosImage from 'assets/images/chaos.png';
import mysteryImage from 'assets/images/mystery.png';
import logicImage from 'assets/images/logic.png';
import structureImage from 'assets/images/structure.png';
import orderImage from 'assets/images/order.png';
import { PageWrapper } from './utils';

const CHART_EMBED_HEIGHT = 400;
const CHART_HEIGHT = 500;

const DUNE_TREASURY_CHART =
  'https://dune.xyz/embeds/321490/612067/621fe92e-859a-4525-be32-33631910b83c';

const AnalyticsPage = () => {
  const dashboardMetrics = useRefreshableDashboardMetrics();

  return (
    <PageWrapper>
      <h3>Temple Price</h3>
      <GridLayout id="grid" columnCount={3}>
        <ItemWrapper id="wrapper">
          <StatsCard
            label="Temple Price"
            stat={`$${formatNumber(dashboardMetrics?.templeValue || 0)}`}
            backgroundColor={theme.palette.brand75}
            backgroundImageUrl={texture1}
            heightPercentage={50}
          />
        </ItemWrapper>
        <ItemWrapper>
          <StatsCard
            label="Risk Free Value"
            stat={`$${formatNumber(dashboardMetrics?.riskFreeValue || 0)}`}
            backgroundColor={theme.palette.brand75}
            backgroundImageUrl={texture4}
            heightPercentage={50}
          />
        </ItemWrapper>
        <ItemWrapper>
          <StatsCard
            label="Intrinsic Value"
            stat={`$${formatNumber(dashboardMetrics?.iv || 0)}`}
            backgroundColor={theme.palette.brand75}
            backgroundImageUrl={texture2}
            heightPercentage={50}
          />
        </ItemWrapper>
      </GridLayout>

      <ChartContainer>
        <PriceChart />
      </ChartContainer>

      <h3>Protocol Growth</h3>
      <div>
        <StatsCard
          label="Treasury Value"
          stat={dashboardMetrics ? `$${formatMillions(dashboardMetrics?.treasuryValue)}` : ''}
          backgroundColor={theme.palette.brand75}
          backgroundImageUrl={texture3}
          heightPercentage={25}
        />
      </div>

      <Spacer small />

      <Embed
        src={DUNE_TREASURY_CHART}
        height={CHART_EMBED_HEIGHT}
      />

      <Spacer small />

      <GridLayout columnCount={4}>
        <ItemWrapper>
          <StatsCard
            label="Circulating Market Cap"
            stat={dashboardMetrics ? `$${formatMillions(dashboardMetrics?.circMCap)}` : ''}
            backgroundColor={theme.palette.dark}
            darken
            fontColor={theme.palette.light}
            backgroundImageUrl={background1}
          />
        </ItemWrapper>
        <ItemWrapper>
          <StatsCard
            label="Fully Diluted Valuation"
            stat={`$${formatMillions(dashboardMetrics ? (
              dashboardMetrics?.templeTotalSupply *
              dashboardMetrics?.templeValue
            ) : 0)}`}
            backgroundColor={theme.palette.dark}
            darken
            fontColor={theme.palette.light}
            backgroundImageUrl={background2}
          />
        </ItemWrapper>
        <ItemWrapper>
          <StatsCard
            label="Circulating TEMPLE supply"
            stat={`${formatMillions(dashboardMetrics?.circTempleSupply || 0)}`}
            backgroundColor={theme.palette.dark}
            darken
            fontColor={theme.palette.light}
            backgroundImageUrl={background3}
          />
        </ItemWrapper>
        <ItemWrapper>
          <StatsCard
            label="Fully Diluted TEMPLE supply"
            stat={`${formatMillions(dashboardMetrics?.templeTotalSupply || 0)}`}
            backgroundColor={theme.palette.dark}
            darken
            fontColor={theme.palette.light}
            backgroundImageUrl={background4}
          />
        </ItemWrapper>
      </GridLayout>

      <h3>Community Growth</h3>

      <GridLayout columnCount={3}>
        <ItemWrapper>
          <StatsCard
            label="Discord Users"
            stat={dashboardMetrics?.socialMetrics?.discord?.totalMembers || ''}
            backgroundColor={theme.palette.brand75}
            backgroundImageUrl={background9}
            heightPercentage={50}
          />
        </ItemWrapper>
        <ItemWrapper>
          <StatsCard
            label="Twitter Followers"
            stat={dashboardMetrics?.socialMetrics?.twitter_followers_count || ''}
            backgroundColor={theme.palette.brand75}
            backgroundImageUrl={background10}
            heightPercentage={50}
          />
        </ItemWrapper>
        <ItemWrapper>
          <StatsCard
            label="Number of Enclaves"
            stat={'5'}
            backgroundColor={theme.palette.brand75}
            fontColor={theme.palette.light}
            backgroundImageUrl={background11}
            heightPercentage={50}
          />
        </ItemWrapper>
      </GridLayout>

      <Spacer small />

      <GridLayout columnCount={5}>
        <ItemWrapper>
          <StatsCard
            label="Members in chaos"
            stat={dashboardMetrics?.socialMetrics?.discord?.enclaveChaos || ''}
            backgroundColor={theme.palette.dark}
            darken
            fontColor={theme.palette.light}
            backgroundImageUrl={chaosImage}
          />
        </ItemWrapper>
        <ItemWrapper>
          <StatsCard
            label="Members in Mystery"
            stat={dashboardMetrics?.socialMetrics?.discord?.enclaveMystery || ''}
            backgroundColor={theme.palette.dark}
            darken
            fontColor={theme.palette.light}
            backgroundImageUrl={mysteryImage}
          />
        </ItemWrapper>
        <ItemWrapper>
          <StatsCard
            label="Members in Logic"
            stat={dashboardMetrics?.socialMetrics?.discord?.enclaveLogic || ''}
            backgroundColor={theme.palette.dark}
            darken
            fontColor={theme.palette.light}
            backgroundImageUrl={logicImage}
          />
        </ItemWrapper>
        <ItemWrapper>
          <StatsCard
            label="Members in structure"
            stat={dashboardMetrics?.socialMetrics?.discord?.enclaveStructure || ''}
            backgroundColor={theme.palette.dark}
            darken
            fontColor={theme.palette.light}
            backgroundImageUrl={structureImage}
          />
        </ItemWrapper>
        <ItemWrapper>
          <StatsCard
            label="Members in order"
            stat={dashboardMetrics?.socialMetrics?.discord?.enclaveOrder || ''}
            backgroundColor={theme.palette.dark}
            darken
            fontColor={theme.palette.light}
            backgroundImageUrl={orderImage}
          />
        </ItemWrapper>
      </GridLayout>
    </PageWrapper>
  );
};

const ChartContainer = styled.div`
  width: 100%;
  height: ${CHART_HEIGHT}px;
`;

const GridLayout = styled.section<{ columnCount: number }>`
  display: grid;
  grid-template-columns: 1fr;
  grid-column-gap: .75rem;
  padding: 0;

  ${({ columnCount }) => phoneAndAbove(`
    grid-template-columns: repeat(${columnCount}, 1fr);
  `)}
`;

const ItemWrapper = styled.div`
  margin: 0 0 .75rem;

  ${phoneAndAbove(`
    margin: 0;
  `)}
`;

export default AnalyticsPage;