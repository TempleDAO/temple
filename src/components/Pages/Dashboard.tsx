//@ts-nocheck

import React from 'react';
import styled from 'styled-components';
import Embed from 'components/Embed/Embed';
import BackButton from 'components/Button/BackButton';
import StatsCard from 'components/StatsCard/StatsCard';
import { PriceChart } from 'components/Charts/PriceChart';
import { FlexStyled } from 'components/Layout/Flex';
import { theme } from 'styles/theme';
import { formatNumber, formatMillions } from 'utils/formatter';
import useRefreshableDashboardMetrics from 'hooks/use-refreshable-dashboard-metrics';
import { CustomRoutingPage } from 'hooks/use-custom-spa-routing';

import texture1 from 'assets/images/texture-1.svg';
import texture2 from 'assets/images/texture-2.svg';
import texture3 from 'assets/images/texture-3.svg';
import texture4 from 'assets/images/texture-4.svg';

import background1 from 'assets/images/dashboard-1.png';
import background2 from 'assets/images/dashboard-2.png';
import background3 from 'assets/images/dashboard-3.png';
import background4 from 'assets/images/dashboard-4.png';

import background5 from 'assets/images/dashboard-5.png';
import background6 from 'assets/images/dashboard-6.png';
import background7 from 'assets/images/dashboard-7.png';
import background8 from 'assets/images/dashboard-8.png';
import background9 from 'assets/images/dashboard-9.png';
import background10 from 'assets/images/dashboard-10.png';
import background11 from 'assets/images/dashboard-11.png';

import chaosImage from 'assets/images/chaos.png';
import mysteryImage from 'assets/images/mystery.png';
import logicImage from 'assets/images/logic.png';
import structureImage from 'assets/images/structure.png';
import orderImage from 'assets/images/order.png';

const CHART_EMBED_MIN_WIDTH = 520;
const CHART_EMBED_HEIGHT = 400;
const CHART_HEIGHT = 500;

const DUNE_TREASURY_CHART =
  'https://dune.xyz/embeds/321490/612067/621fe92e-859a-4525-be32-33631910b83c';
const DUNE_OGTEMPLE_CHART =
  'https://dune.xyz/embeds/321944/612832/822318f7-5c30-4a12-8688-3fea73e3f3ea';
const DUNE_RATIO_CHART =
  'https://dune.xyz/embeds/321528/612129/a6738355-8078-4cfd-b12d-b142559e1ab0';

// const VALUE_EMBED_MIN_WIDTH = 320;
// const VALUE_EMBED_HEIGHT = 200;

// const DUNE_TEMPLAR_COUNT_VALUE =
//   'https://dune.xyz/embeds/246769/461309/56669aec-2b5d-48fc-8461-86c2962d8aaa';
// const DUNE_MEDIAN_ROI_VALUE =
//   'https://dune.xyz/embeds/246769/461324/0f3f5fb4-d933-47ec-84f8-233ebb4c9f44';
// const DUNE_HIGHEST_ROI_VALUE =
//   'https://dune.xyz/embeds/246769/461328/05d82f24-3140-4cf7-a142-3a50920465d8';

// const DUNE_OTC_IC_CHART =
//   'https://dune.xyz/embeds/237286/444046/1a8062c9-ca57-48cc-b6a6-7062d2c6086e';
// const DUNE_OTC_VALUE =
//   'https://dune.xyz/embeds/237286/444160/d36b882d-7858-447b-8c1b-72b7f83ac0f1';
// const DUNE_IV_VALUE =
//   'https://dune.xyz/embeds/237286/444047/aa5f47b4-5f68-487b-82de-4d8f631f5991';

// const DUNE_MC_VALUE =
//   'https://dune.xyz/embeds/237286/444067/8e5d34dd-b456-4fbf-9ae0-22df01776876';
// const DUNE_FDV_VALUE =
//   'https://dune.xyz/embeds/237286/444068/f157547b-2eb1-4b5d-9dc7-b82488b3d2ec';
// const DUNE_MC_FDV_CHART =
//   'https://dune.xyz/embeds/237286/444080/af60a575-a149-4e33-8b0f-2e64c34a5b7b';

// const DUNE_SUPPLY_VALUE =
//   'https://dune.xyz/embeds/237286/444072/890d6271-c6a8-4922-9be2-1a2cf092183b';
// const DUNE_FULLY_DILUTED_SUPPLY_VALUE =
//   'https://dune.xyz/embeds/237286/444045/2b05e6e2-b8b7-4f5c-8421-84846de24365';
// const DUNE_SUPPLY_CHART =
//   'https://dune.xyz/embeds/237286/444048/3dcfe855-2d59-4f0b-b1b2-87bd0f114c7f';

// const DUNE_TREASURY_VALUE =
//   'https://dune.xyz/embeds/237286/444044/5f7a4ccf-52df-4b48-ba1f-467effd8da48';
// const DUNE_HARVESTED_TEMPLE_VALUE =
//   'https://dune.xyz/embeds/237286/444076/cf555149-fb7c-4aa2-9cb1-8a472742b4e6';

// const DUNE_EPY_VALUE =
//   'https://dune.xyz/embeds/237286/444078/39fefc62-beda-4c47-a897-1ee7edf5c7f1';
// const DUNE_RUNWAY_VALUE =
//   'https://dune.xyz/embeds/237286/444077/6ca3b388-1bfd-42ff-8b5b-65fe4b706ef3';
// const DUNE_RUNWAY_CHART =
//   'https://dune.xyz/embeds/237286/444148/88906b9e-e1d8-42f0-b3a3-79cae2614f05';

// const DUNE_MEDIAN_SACRIFICE_VALUE =
//   'https://dune.xyz/embeds/246769/461312/6996216f-9c7c-41f0-b488-408ea6579009';
// const DUNE_AVERAGE_SACRIFICE_VALUE =
//   'https://dune.xyz/embeds/246769/461311/ad19a32b-c204-4f2e-be2f-a9753f781f4c';
// const DUNE_LOWEST_ROI_VALUE =
//   'https://dune.xyz/embeds/246769/461325/560e2957-e08f-4a86-af03-7125469c23e5';
// const DUNE_OGTEMPLE_VALUE =
//   'https://dune.xyz/embeds/237286/444168/b2447320-615a-4adc-9eb8-871b70520c80';
// const DUNE_RATIO_VALUE =
//   'https://dune.xyz/embeds/237286/444167/ae8ef580-ef5f-4123-b629-72fc87da465d';

const Dashboard: CustomRoutingPage = ({ routingHelper }) => {
  const { back } = routingHelper;

  const dashboardMetrics = useRefreshableDashboardMetrics();

  return (
    <>
      <PageWrapper>
        <h3>Temple Price</h3>
        <FlexStyled
          layout={{
            kind: 'container',
            direction: 'row',
            justifyContent: 'flex-start',
            canWrap: true,
          }}
        >
          <FlexStyled
            layout={{
              kind: 'item',
            }}
          >
            <StatsCard
              label="Temple Price"
              stat={`$${formatNumber(dashboardMetrics?.templeValue)}`}
              backgroundColor={theme.palette.brand75}
              backgroundImageUrl={texture1}
              heightPercentage={35}
            />
          </FlexStyled>

          <FlexStyled
            layout={{
              kind: 'item',
            }}
          >
            <StatsCard
              label="Risk Free Value"
              stat={`$${formatNumber(dashboardMetrics?.riskFreeValue)}`}
              backgroundColor={theme.palette.brand75}
              backgroundImageUrl={texture4}
              heightPercentage={35}
            />
          </FlexStyled>

          <FlexStyled
            layout={{
              kind: 'item',
            }}
          >
            <StatsCard
              label="Intrinsic Value"
              stat={`$${formatNumber(dashboardMetrics?.iv)}`}
              backgroundColor={theme.palette.brand75}
              backgroundImageUrl={texture2}
              heightPercentage={35}
            />
          </FlexStyled>
        </FlexStyled>
        <ChartContainer>
          <PriceChart />
        </ChartContainer>
        <h3>Protocol Growth</h3>
        <FlexStyled
          layout={{
            kind: 'container',
            direction: 'row',
            justifyContent: 'flex-start',
            canWrap: true,
          }}
        >
          <FlexStyled
            layout={{
              kind: 'item',
            }}
          >
            <StatsCard
              label="Treasury Value"
              stat={`$${formatMillions(dashboardMetrics?.treasuryValue)}`}
              backgroundColor={theme.palette.brand75}
              backgroundImageUrl={texture3}
              heightPercentage={35}
            />
          </FlexStyled>

          <FlexStyled
            layout={{
              kind: 'item',
            }}
          >
            <StatsCard
              label="Current Apy (EXCLUDING FAITH BONUS)"
              stat={`${formatNumber(dashboardMetrics?.templeApy)}%`}
              backgroundColor={theme.palette.brand75}
              backgroundImageUrl={texture4}
              heightPercentage={35}
            />
          </FlexStyled>
        </FlexStyled>
        <Embed
          src={DUNE_TREASURY_CHART}
          minWidth={CHART_EMBED_MIN_WIDTH}
          height={CHART_EMBED_HEIGHT}
        />
        <FlexStyled
          layout={{
            kind: 'container',
            direction: 'row',
            justifyContent: 'flex-start',
            canWrap: true,
          }}
        >
          <FlexStyled
            layout={{
              kind: 'item',
            }}
          >
            <StatsCard
              label="Circulating Market Cap"
              stat={`$${formatMillions(dashboardMetrics?.circMCap)}`}
              backgroundColor={theme.palette.dark}
              darken
              fontColor={theme.palette.light}
              backgroundImageUrl={background1}
            />
          </FlexStyled>

          <FlexStyled
            layout={{
              kind: 'item',
            }}
          >
            <StatsCard
              label="Fully Diluted Valuation"
              stat={`$${formatMillions(
                dashboardMetrics?.templeTotalSupply *
                  dashboardMetrics?.templeValue
              )}`}
              backgroundColor={theme.palette.dark}
              darken
              fontColor={theme.palette.light}
              backgroundImageUrl={background2}
            />
          </FlexStyled>

          <FlexStyled
            layout={{
              kind: 'item',
            }}
          >
            <StatsCard
              label="Circulating TEMPLE supply"
              stat={`${formatMillions(dashboardMetrics?.circTempleSupply)}`}
              backgroundColor={theme.palette.dark}
              darken
              fontColor={theme.palette.light}
              backgroundImageUrl={background3}
            />
          </FlexStyled>

          <FlexStyled
            layout={{
              kind: 'item',
            }}
          >
            <StatsCard
              label="Fully Diluted TEMPLE supply"
              stat={`${formatMillions(dashboardMetrics?.templeTotalSupply)}`}
              backgroundColor={theme.palette.dark}
              darken
              fontColor={theme.palette.light}
              backgroundImageUrl={background4}
            />
          </FlexStyled>
        </FlexStyled>

        <h3>Compounding Return</h3>

        <FlexStyled
          layout={{
            kind: 'container',
            direction: 'row',
            justifyContent: 'flex-start',
            canWrap: true,
          }}
        >
          <FlexStyled
            layout={{
              kind: 'item',
            }}
          >
            <StatsCard
              label="Temple Price"
              stat={`$${formatNumber(dashboardMetrics?.templeValue)}`}
              backgroundColor={theme.palette.brand75}
              backgroundImageUrl={background5}
            />
          </FlexStyled>

          <FlexStyled
            layout={{
              kind: 'item',
            }}
          >
            <StatsCard
              label="Current EPY (daily)"
              stat={`${formatNumber(dashboardMetrics?.templeEpy)}%`}
              backgroundColor={theme.palette.brand75}
              backgroundImageUrl={background6}
            />
          </FlexStyled>

          <FlexStyled
            layout={{
              kind: 'item',
            }}
          >
            <StatsCard
              label="OGTemple Price"
              stat={`$${formatNumber(dashboardMetrics?.ogTemplePrice)}`}
              backgroundColor={theme.palette.brand75}
              fontColor={theme.palette.light}
              backgroundImageUrl={background7}
            />
          </FlexStyled>

          <FlexStyled
            layout={{
              kind: 'item',
            }}
          >
            <StatsCard
              label="Temple/OGTemple Ratio"
              stat={`${formatNumber(dashboardMetrics?.ogTempleRatio)}`}
              backgroundColor={theme.palette.brand75}
              fontColor={theme.palette.light}
              backgroundImageUrl={background8}
            />
          </FlexStyled>
        </FlexStyled>

        <FlexStyled
          layout={{
            kind: 'container',
            direction: 'row',
            justifyContent: 'flex-start',
            canWrap: true,
          }}
        >
          <FlexStyled
            layout={{
              kind: 'item',
            }}
          >
            <Embed
              src={DUNE_OGTEMPLE_CHART}
              minWidth={CHART_EMBED_MIN_WIDTH}
              height={CHART_EMBED_HEIGHT}
            />
          </FlexStyled>
          <FlexStyled
            layout={{
              kind: 'item',
            }}
          >
            <Embed
              src={DUNE_RATIO_CHART}
              minWidth={CHART_EMBED_MIN_WIDTH}
              height={CHART_EMBED_HEIGHT}
            />
          </FlexStyled>
        </FlexStyled>

        <h3>Community Growth</h3>
        <FlexStyled
          layout={{
            kind: 'container',
            direction: 'row',
            justifyContent: 'flex-start',
            canWrap: true,
          }}
        >
          <FlexStyled
            layout={{
              kind: 'item',
            }}
          >
            <StatsCard
              label="Discord Users"
              stat={dashboardMetrics?.socialMetrics?.discord?.totalMembers}
              backgroundColor={theme.palette.brand75}
              backgroundImageUrl={background9}
              heightPercentage={60}
            />
          </FlexStyled>

          <FlexStyled
            layout={{
              kind: 'item',
            }}
          >
            <StatsCard
              label="Twitter Followers"
              stat={dashboardMetrics?.socialMetrics?.twitter_followers_count}
              backgroundColor={theme.palette.brand75}
              backgroundImageUrl={background10}
              heightPercentage={60}
            />
          </FlexStyled>

          <FlexStyled
            layout={{
              kind: 'item',
            }}
          >
            <StatsCard
              label="Number of Enclaves"
              stat={'5'}
              backgroundColor={theme.palette.brand75}
              fontColor={theme.palette.light}
              backgroundImageUrl={background11}
              heightPercentage={60}
            />
          </FlexStyled>
        </FlexStyled>
        <FlexStyled
          layout={{
            kind: 'container',
            direction: 'row',
            justifyContent: 'flex-start',
            canWrap: true,
          }}
        >
          <FlexStyled
            layout={{
              kind: 'item',
            }}
          >
            <StatsCard
              label="Members in chaos"
              stat={dashboardMetrics?.socialMetrics?.discord?.enclaveChaos}
              backgroundColor={theme.palette.dark}
              darken
              fontColor={theme.palette.light}
              backgroundImageUrl={chaosImage}
            />
          </FlexStyled>
          <FlexStyled
            layout={{
              kind: 'item',
            }}
          >
            <StatsCard
              label="Members in Mystery"
              stat={dashboardMetrics?.socialMetrics?.discord?.enclaveMystery}
              backgroundColor={theme.palette.dark}
              darken
              fontColor={theme.palette.light}
              backgroundImageUrl={mysteryImage}
            />
          </FlexStyled>

          <FlexStyled
            layout={{
              kind: 'item',
            }}
          >
            <StatsCard
              label="Members in Logic"
              stat={dashboardMetrics?.socialMetrics?.discord?.enclaveLogic}
              backgroundColor={theme.palette.dark}
              darken
              fontColor={theme.palette.light}
              backgroundImageUrl={logicImage}
            />
          </FlexStyled>

          <FlexStyled
            layout={{
              kind: 'item',
            }}
          >
            <StatsCard
              label="Members in structure"
              stat={dashboardMetrics?.socialMetrics?.discord?.enclaveStructure}
              backgroundColor={theme.palette.dark}
              darken
              fontColor={theme.palette.light}
              backgroundImageUrl={structureImage}
            />
          </FlexStyled>

          <FlexStyled
            layout={{
              kind: 'item',
            }}
          >
            <StatsCard
              label="Members in order"
              stat={dashboardMetrics?.socialMetrics?.discord?.enclaveOrder}
              backgroundColor={theme.palette.dark}
              darken
              fontColor={theme.palette.light}
              backgroundImageUrl={orderImage}
            />
          </FlexStyled>
        </FlexStyled>
      </PageWrapper>
      <BackButton onClick={back} />
    </>
  );
};

// remove the padding when we are not doing custom routing
const PageWrapper = styled.div`
  padding: 3rem 0;
  max-width: ${(props) => props.theme.metrics.desktop.maxWidth};
  margin: 0 auto;
`;

const ChartContainer = styled.div`
  width: 100%;
  height: ${CHART_HEIGHT}px;
`;

export default Dashboard;
