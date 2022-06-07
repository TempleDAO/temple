import styled from 'styled-components';

import Embed from 'components/Embed/Embed';
import StatsCard from 'components/StatsCard/StatsCard';
import { PriceChart } from 'components/Charts/PriceChart';
import { Spacer } from 'components/AMM/helpers/components';
import Loader from 'components/Loader/Loader';
import Image from 'components/Image/Image';

import { theme } from 'styles/theme';
import { formatMillions } from 'utils/formatter';
import useRefreshableDashboardMetrics from 'hooks/use-refreshable-dashboard-metrics';
import { phoneAndAbove } from 'styles/breakpoints';

import duneLogo from 'assets/images/dune-logo.png';
import texture3 from 'assets/images/texture-3.svg';
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

import { useAnalytics } from 'hooks/use-analytics';

import { NAV_DESKTOP_HEIGHT_PIXELS } from 'components/Layouts/CoreLayout/Header';

const CHART_EMBED_HEIGHT = 400;
const CHART_HEIGHT = 500;

const DUNE_TREASURY_CHART = 'https://dune.xyz/embeds/321490/612067/621fe92e-859a-4525-be32-33631910b83c';

const AnalyticsPage = () => {
  const { isLoading, analytics, error } = useAnalytics();

  if (isLoading) {
    return (
      <Container>
        <Loader />
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <p>Error fetching analytics</p>
      </Container>
    );
  }

  return (
    <PageWrapper>
      <DuneDashboardLink href={'https://dune.com/templedao/Temple-AMM-Key-Metrics'} target={'_blank'} rel="noreferrer">
        <Image src={duneLogo} alt={''} width={24} height={24} />
        <span>Go to Dune Dashboard</span>
      </DuneDashboardLink>
      <h3>Temple Price</h3>

      <ChartContainer>
        <PriceChart />
      </ChartContainer>

      <h3>Protocol Growth</h3>
      <div>
        <StatsCard
          label="Treasury Value"
          stat={`$${formatMillions(analytics.treasuryValue)}`}
          backgroundColor={theme.palette.brand75}
          backgroundImageUrl={texture3}
          heightPercentage={25}
        />
      </div>

      <Spacer small />

      <Embed src={DUNE_TREASURY_CHART} height={CHART_EMBED_HEIGHT} />

      <Spacer small />

      <GridLayout columnCount={4}>
        <ItemWrapper>
          <StatsCard
            label="Circulating Market Cap"
            stat={`$${formatMillions(analytics.circulatingMarketCap)}`}
            backgroundColor={theme.palette.dark}
            darken
            fontColor={theme.palette.light}
            backgroundImageUrl={background1}
          />
        </ItemWrapper>
        <ItemWrapper>
          <StatsCard
            label="Fully Diluted Valuation"
            stat={`$${formatMillions(analytics.fullyDilutedValuation)}`}
            backgroundColor={theme.palette.dark}
            darken
            fontColor={theme.palette.light}
            backgroundImageUrl={background2}
          />
        </ItemWrapper>
        <ItemWrapper>
          <StatsCard
            label="Circulating $TEMPLE supply"
            stat={formatMillions(analytics.circulatingTempleSupply)}
            backgroundColor={theme.palette.dark}
            darken
            fontColor={theme.palette.light}
            backgroundImageUrl={background3}
          />
        </ItemWrapper>
        <ItemWrapper>
          <StatsCard
            label="Fully Diluted $TEMPLE supply"
            stat={formatMillions(analytics.fullyDilutedTempleSupply)}
            backgroundColor={theme.palette.dark}
            darken
            fontColor={theme.palette.light}
            backgroundImageUrl={background4}
          />
        </ItemWrapper>
      </GridLayout>

      {/* 
        TODO: Re-enable when backend.templedao.link is restored.
      */}

      {/* <h3>Community Growth</h3>

      <GridLayout columnCount={3}>
        <ItemWrapper>
          <StatsCard
            label="Discord Users"
            stat={0}
            backgroundColor={theme.palette.brand75}
            backgroundImageUrl={background9}
            heightPercentage={50}
          />
        </ItemWrapper>
        <ItemWrapper>
          <StatsCard
            label="Twitter Followers"
            stat={0}
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
            stat={0}
            backgroundColor={theme.palette.dark}
            darken
            fontColor={theme.palette.light}
            backgroundImageUrl={chaosImage}
          />
        </ItemWrapper>
        <ItemWrapper>
          <StatsCard
            label="Members in Mystery"
            stat={0}
            backgroundColor={theme.palette.dark}
            darken
            fontColor={theme.palette.light}
            backgroundImageUrl={mysteryImage}
          />
        </ItemWrapper>
        <ItemWrapper>
          <StatsCard
            label="Members in Logic"
            stat={0}
            backgroundColor={theme.palette.dark}
            darken
            fontColor={theme.palette.light}
            backgroundImageUrl={logicImage}
          />
        </ItemWrapper>
        <ItemWrapper>
          <StatsCard
            label="Members in structure"
            stat={0}
            backgroundColor={theme.palette.dark}
            darken
            fontColor={theme.palette.light}
            backgroundImageUrl={structureImage}
          />
        </ItemWrapper>
        <ItemWrapper>
          <StatsCard
            label="Members in order"
            stat={0}
            backgroundColor={theme.palette.dark}
            darken
            fontColor={theme.palette.light}
            backgroundImageUrl={orderImage}
          />
        </ItemWrapper>
      </GridLayout> */}
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
  grid-column-gap: 0.75rem;
  padding: 0;

  ${({ columnCount }) =>
    phoneAndAbove(`
    grid-template-columns: repeat(${columnCount}, 1fr);
  `)}
`;

const ItemWrapper = styled.div`
  margin: 0 0 0.75rem;

  ${phoneAndAbove(`
    margin: 0;
  `)}
`;

const DuneDashboardLink = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
  span {
    display: inline-block;
    margin-left: 0.625rem;
    font-size: 1rem;
    text-decoration: underline;
  }
`;

const Container = styled.div`
  width: 100%;
  height: calc(100vh - ${NAV_DESKTOP_HEIGHT_PIXELS}px);
  overflow-y: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
`;

export default AnalyticsPage;
