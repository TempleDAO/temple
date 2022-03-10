//@ts-nocheck
import React from 'react';
import styled from 'styled-components';

import Embed from 'components/Embed/Embed';
import StatsCard from 'components/StatsCard/StatsCard';
import { PriceChart } from 'components/Charts/PriceChart';
import { Flex } from 'components/Layout/Flex';
import { Spacer } from 'components/AMM/helpers/components';
import { theme } from 'styles/theme';
import { formatNumber, formatMillions } from 'utils/formatter';
import useRefreshableDashboardMetrics from 'hooks/use-refreshable-dashboard-metrics';

import texture1 from 'assets/images/texture-1.svg';
import texture2 from 'assets/images/texture-2.svg';
import texture3 from 'assets/images/texture-3.svg';
import texture4 from 'assets/images/texture-4.svg';

import background1 from 'assets/images/dashboard-1.png';
import background2 from 'assets/images/dashboard-2.png';
import background3 from 'assets/images/dashboard-3.png';
import background4 from 'assets/images/dashboard-4.png';

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

const AnalyticsPage = () => {
  const dashboardMetrics = useRefreshableDashboardMetrics();
  console.log(dashboardMetrics)
  return (
    <>
    <h3>Temple Price</h3>
        <Flex
          layout={{
            kind: 'container',
            direction: 'row',
            justifyContent: 'flex-start',
            canWrap: true,
          }}
        >
          <Flex
            layout={{
              kind: 'item',
              smallMargin: true,
            }}
          >
            <StatsCard
              label="Temple Price"
              stat={`$${formatNumber(dashboardMetrics?.templeValue || 0)}`}
              backgroundColor={theme.palette.brand75}
              backgroundImageUrl={texture1}
              heightPercentage={50}
            />
          </Flex>

          <Flex
            layout={{
              kind: 'item',
              smallMargin: true,
            }}
          >
            <StatsCard
              label="Risk Free Value"
              stat={`$${formatNumber(dashboardMetrics?.riskFreeValue || 0)}`}
              backgroundColor={theme.palette.brand75}
              backgroundImageUrl={texture4}
              heightPercentage={50}
            />
          </Flex>

          <Flex
            layout={{
              kind: 'item',
              smallMargin: true,
            }}
          >
            <StatsCard
              label="Intrinsic Value"
              stat={`$${formatNumber(dashboardMetrics?.iv)}`}
              backgroundColor={theme.palette.brand75}
              backgroundImageUrl={texture2}
              heightPercentage={50}
            />
          </Flex>
        </Flex>
        <ChartContainer>
          <PriceChart />
        </ChartContainer>
        <h3>Protocol Growth</h3>
        <Flex
          layout={{
            kind: 'container',
            direction: 'row',
            justifyContent: 'flex-start',
            canWrap: true,
          }}
        >
          <Flex
            layout={{
              kind: 'item',
              smallMargin: true,
            }}
          >
            <StatsCard
              label="Treasury Value"
              stat={`$${formatMillions(dashboardMetrics?.treasuryValue)}`}
              backgroundColor={theme.palette.brand75}
              backgroundImageUrl={texture3}
              heightPercentage={35}
            />
          </Flex>

          <Flex
            layout={{
              kind: 'item',
              smallMargin: true,
            }}
          >
            <StatsCard
              label="Current Apy (EXCLUDING FAITH BONUS)"
              stat={`${formatNumber(dashboardMetrics?.templeApy)}%`}
              backgroundColor={theme.palette.brand75}
              backgroundImageUrl={texture4}
              heightPercentage={35}
            />
          </Flex>
        </Flex>

        <Spacer small />

        <Embed
          src={DUNE_TREASURY_CHART}
          minWidth={CHART_EMBED_MIN_WIDTH}
          height={CHART_EMBED_HEIGHT}
        />

        <Spacer small />

        <Flex
          layout={{
            kind: 'container',
            direction: 'row',
            justifyContent: 'flex-start',
            canWrap: true,
          }}
        >
          <Flex
            layout={{
              kind: 'item',
              smallMargin: true,
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
          </Flex>

          <Flex
            layout={{
              kind: 'item',
              smallMargin: true,
            }}
          >
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
          </Flex>

          <Flex
            layout={{
              kind: 'item',
              smallMargin: true,
            }}
          >
            <StatsCard
              label="Circulating TEMPLE supply"
              stat={`${formatMillions(dashboardMetrics?.circTempleSupply || 0)}`}
              backgroundColor={theme.palette.dark}
              darken
              fontColor={theme.palette.light}
              backgroundImageUrl={background3}
            />
          </Flex>

          <Flex
            layout={{
              kind: 'item',
              smallMargin: true,
            }}
          >
            <StatsCard
              label="Fully Diluted TEMPLE supply"
              stat={`${formatMillions(dashboardMetrics?.templeTotalSupply || 0)}`}
              backgroundColor={theme.palette.dark}
              darken
              fontColor={theme.palette.light}
              backgroundImageUrl={background4}
            />
          </Flex>
        </Flex>

        <h3>Compounding Return</h3>

        <Flex
          layout={{
            kind: 'container',
            direction: 'row',
            justifyContent: 'flex-start',
            canWrap: true,
          }}
        >
          <Flex
            layout={{
              kind: 'item',
              smallMargin: true,
            }}
          >
            <StatsCard
              label="Temple Price"
              stat={`$${formatNumber(dashboardMetrics?.templeValue || 0)}`}
              backgroundColor={theme.palette.brand75}
              backgroundImageUrl={texture2}
              heightPercentage={35}
            />
          </Flex>

          <Flex
            layout={{
              kind: 'item',
              smallMargin: true,
            }}
          >
            <StatsCard
              label="OGTemple Price"
              stat={`$${formatNumber(dashboardMetrics?.ogTemplePrice || 0)}`}
              backgroundColor={theme.palette.brand75}
              fontColor={theme.palette.light}
              backgroundImageUrl={texture1}
              heightPercentage={35}
            />
          </Flex>
        </Flex>

        <Spacer small />

        <Flex
          layout={{
            kind: 'container',
            direction: 'row',
            justifyContent: 'flex-start',
            canWrap: true,
          }}
        >
          <Flex
            layout={{
              kind: 'item',
              smallMargin: true,
            }}
          >
            <Embed
              src={DUNE_OGTEMPLE_CHART}
              minWidth={CHART_EMBED_MIN_WIDTH}
              height={CHART_EMBED_HEIGHT}
            />
          </Flex>
          <Flex
            layout={{
              kind: 'item',
              smallMargin: true,
            }}
          >
            <Embed
              src={DUNE_RATIO_CHART}
              minWidth={CHART_EMBED_MIN_WIDTH}
              height={CHART_EMBED_HEIGHT}
            />
          </Flex>
        </Flex>

        <Spacer small />

        <Flex
          layout={{
            kind: 'container',
            direction: 'row',
            justifyContent: 'flex-start',
            canWrap: true,
          }}
        >
          <Flex
            layout={{
              kind: 'item',
              smallMargin: true,
            }}
          >
            <StatsCard
              label="Current EPY (daily)"
              stat={`${formatNumber(dashboardMetrics?.templeEpy || 0)}%`}
              backgroundColor={theme.palette.dark}
              backgroundImageUrl={background9}
              fontColor={theme.palette.light}
              darken
              heightPercentage={50}
            />
          </Flex>
          <Flex
            layout={{
              kind: 'item',
              smallMargin: true,
            }}
          >
            <StatsCard
              label="Temple/OGTemple Ratio"
              stat={`${formatNumber(dashboardMetrics?.ogTempleRatio || 0)}`}
              backgroundColor={theme.palette.dark}
              fontColor={theme.palette.light}
              backgroundImageUrl={background8}
              darken
              heightPercentage={50}
            />
          </Flex>

          <Flex
            layout={{
              kind: 'item',
              smallMargin: true,
            }}
          >
            <StatsCard
              label="percentage of TEMPLE staked"
            stat={`${formatNumber(
              dashboardMetrics ? (
                dashboardMetrics?.percentageStaked * 100
              ) : 0 )}%`}
              backgroundColor={theme.palette.dark}
              darken
              fontColor={theme.palette.light}
              backgroundImageUrl={background4}
              heightPercentage={50}
            />
          </Flex>
        </Flex>

        <h3>Community Growth</h3>
        <Flex
          layout={{
            kind: 'container',
            direction: 'row',
            justifyContent: 'flex-start',
            canWrap: true,
          }}
        >
          <Flex
            layout={{
              kind: 'item',
              smallMargin: true,
            }}
          >
            <StatsCard
              label="Discord Users"
              stat={dashboardMetrics?.socialMetrics?.discord?.totalMembers || ''}
              backgroundColor={theme.palette.brand75}
              backgroundImageUrl={background9}
              heightPercentage={50}
            />
          </Flex>

          <Flex
            layout={{
              kind: 'item',
              smallMargin: true,
            }}
          >
            <StatsCard
              label="Twitter Followers"
              stat={dashboardMetrics?.socialMetrics?.twitter_followers_count}
              backgroundColor={theme.palette.brand75}
              backgroundImageUrl={background10}
              heightPercentage={50}
            />
          </Flex>

          <Flex
            layout={{
              kind: 'item',
              smallMargin: true,
            }}
          >
            <StatsCard
              label="Number of Enclaves"
              stat={'5'}
              backgroundColor={theme.palette.brand75}
              fontColor={theme.palette.light}
              backgroundImageUrl={background11}
              heightPercentage={50}
            />
          </Flex>
        </Flex>

        <Spacer small />

        <Flex
          layout={{
            kind: 'container',
            direction: 'row',
            justifyContent: 'flex-start',
            canWrap: true,
          }}
        >
          <Flex
            layout={{
              kind: 'item',
              smallMargin: true,
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
          </Flex>
          <Flex
            layout={{
              kind: 'item',
              smallMargin: true,
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
          </Flex>

          <Flex
            layout={{
              kind: 'item',
              smallMargin: true,
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
          </Flex>

          <Flex
            layout={{
              kind: 'item',
              smallMargin: true,
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
          </Flex>

          <Flex
            layout={{
              kind: 'item',
              smallMargin: true,
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
          </Flex>
        </Flex>
    </>
  )
};

const ChartContainer = styled.div`
  width: 100%;
  height: ${CHART_HEIGHT}px;
`;

export default AnalyticsPage;