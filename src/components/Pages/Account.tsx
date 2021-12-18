//@ts-nocheck

import React, { useEffect, useState } from 'react';
import BackButton from 'components/Button/BackButton';
import ProfileHeader from 'components/ProfileHeader/ProfileHeader';
import AccessoriesTemplate from 'components/Accessories/AccessoriesTemplate';
import ProfileMetric from 'components/ProfileMetric/ProfileMetric';
import EnclaveCard from 'components/EnclaveCard/EnclaveCard';
import styled from 'styled-components';
import { FlexStyled } from 'components/Layout/Flex';
import withWallet from 'hoc/withWallet';
import { useWallet } from 'providers/WalletProvider';
import useRefreshableAccountMetrics from 'hooks/use-refreshable-account-metrics';
import useFetchStoreDiscordUser from 'hooks/use-fetch-store-discord-user';
import { formatNumberWithCommas } from 'utils/formatter';
import { CustomRoutingPage } from 'hooks/use-custom-spa-routing';
import axios from 'axios';

export interface DiscordUser {
  user_id: string;
  user_name: string;
  guild_name: string;
  enclave: string;
  engagementlast7days: string;
  engagementlast30days: string;
  engagementalltime: SVGStringList;
  roles: string[];
}

const Account: CustomRoutingPage = ({ routingHelper }) => {
  const { back } = routingHelper;

  const { wallet, balance, exitQueueData } = useWallet();
  const [discordData, setDiscordData] = useState<DiscordUser>();
  const discordId = useFetchStoreDiscordUser();
  const accountMetrics = useRefreshableAccountMetrics(wallet, discordId);

  useEffect(() => {
    const getDiscordUser = async (
      userId?: string
    ): Promise<DiscordUser | null> => {
      if (!userId) {
        return;
      }
      const response = await axios({
        url: `https://temple-analytics.vercel.app/api/discord/members/${userId}`,
      });
      setDiscordData(response?.data);
    };
    getDiscordUser(discordId);
  }, [discordId, setDiscordData]);

  const walletValue =
    accountMetrics?.templeBalance * accountMetrics?.templeValue;
  const exitQueueValue =
    exitQueueData?.totalTempleOwned * accountMetrics?.templeValue;
  const ogTempleWalletValue = balance?.ogTemple * accountMetrics?.templeValue;
  const lockedOGTempleValue =
    accountMetrics?.lockedOGTempleBalance * accountMetrics?.ogTemplePrice;
  const unclaimedOGTempleValue =
    accountMetrics?.unClaimedOGTempleBalance * accountMetrics?.ogTemplePrice;

  const netWorth =
    unclaimedOGTempleValue +
    lockedOGTempleValue +
    walletValue +
    ogTempleWalletValue +
    exitQueueValue;

  return (
    <>
      <PageWrapper>
        <Container>
          <MetricsWrapper>
            <MetricsFlex
              layout={{
                kind: 'container',
                canWrapTablet: false,
              }}
            >
              <MetricsFlexItem
                gradientDirection={'left'}
                layout={{
                  direction: 'column',
                  kind: 'item',
                  col: 'fullwidth',
                  colTablet: 'half',
                  justifyContent: 'space-between',
                }}
              >
                {!!accountMetrics ? (
                  <>
                    <div>
                      <div>
                        <ProfileMetric
                          label={'net worth'}
                          value={`$${formatNumberWithCommas(netWorth)}`}
                          fontSize={1.5}
                        />
                      </div>
                      <SectionHeader>Unstaked (TEMPLE)</SectionHeader>
                      <div>
                        <ProfileMetric
                          label={'wallet'}
                          value={`${formatNumberWithCommas(
                            accountMetrics?.templeBalance
                          )} TEMPLE`}
                          detail={`$${formatNumberWithCommas(walletValue)}`}
                        />
                        <ProfileMetric
                          label={`Exit Queue`}
                          value={`${formatNumberWithCommas(
                            exitQueueData?.totalTempleOwned
                          )} TEMPLE`}
                          detail={`$${formatNumberWithCommas(exitQueueValue)}`}
                        />
                      </div>
                    </div>
                    <div>
                      <SectionHeader>Staked (OGTEMPLE)</SectionHeader>
                      <LeftMargin>{`(${accountMetrics?.templeApy}% APY)`}</LeftMargin>
                      <div>
                        <ProfileMetric
                          label={'wallet'}
                          value={`${formatNumberWithCommas(
                            balance?.ogTemple
                          )} OGTEMPLE`}
                          detail={`$${formatNumberWithCommas(
                            ogTempleWalletValue
                          )}`}
                        />
                      </div>
                      <div>
                        <ProfileMetric
                          label={`not claimed`}
                          value={`${formatNumberWithCommas(
                            accountMetrics?.unClaimedOGTempleBalance
                          )} OGTEMPLE`}
                          detail={`$${formatNumberWithCommas(
                            unclaimedOGTempleValue
                          )}`}
                        />
                        <ProfileMetric
                          label={`Locked`}
                          value={`${formatNumberWithCommas(
                            accountMetrics?.lockedOGTempleBalance
                          )} OGTEMPLE`}
                          detail={`$${formatNumberWithCommas(
                            lockedOGTempleValue
                          )}`}
                        />
                      </div>
                    </div>
                  </>
                ) : null}
              </MetricsFlexItem>
              <MetricsFlexItem
                gradientDirection={'right'}
                layout={{
                  direction: 'column',
                  kind: 'item',
                  col: 'fullwidth',
                  colTablet: 'half',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <RightAlign>
                    <ProfileMetric label={'faith share'} value={`0%`} />
                    <ProfileMetric label={'temple share'} value={`0%`} />
                  </RightAlign>
                  <RightAlign>
                    <ProfileMetric label={'faith'} value={`0 FAITH`} />
                  </RightAlign>
                </div>
                <DiscordMetricsContainer
                  layout={{
                    kind: 'container',
                    direction: 'column',
                    alignItems: 'center',
                  }}
                >
                  <RightAlign>
                    <EnclaveCard
                      enclave={discordData?.enclave.toLocaleLowerCase()}
                      unsetDiscrodData={() => setDiscordData(null)}
                    />
                  </RightAlign>
                  <RightAlign hidden={!discordData}>
                    <ProfileMetric
                      label={`Activity 7 Days`}
                      value={`${discordData?.engagementlast7days}`}
                    />

                    <ProfileMetric
                      label={`Activity All Time`}
                      value={`${discordData?.engagementalltime}`}
                    />
                  </RightAlign>
                </DiscordMetricsContainer>
              </MetricsFlexItem>
            </MetricsFlex>
          </MetricsWrapper>
          <ProfileWrapper>
            <FlexStyled
              layout={{
                kind: 'container',
                direction: 'column',
                alignItems: 'center',
              }}
            >
              <ProfileHeader username={discordData?.guild_name} />
              <AccessoriesTemplate
                enclave={discordData?.enclave.toLocaleLowerCase()}
              />
            </FlexStyled>
          </ProfileWrapper>
        </Container>
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

const Container = styled.div`
  position: relative;
`;

const MetricsWrapper = styled.div`
  position: absolute;
  width: 100%;
  height: calc(100% - 6rem);
  top: 6rem;
`;

const MetricsFlex = styled(FlexStyled)`
  height: 100%;
  margin-top: 0;
  margin-bottom: 0;
  padding-bottom: 1rem;
`;

const MetricsFlexItem = styled(MetricsFlex)`
  background-image: linear-gradient(
    to ${(props) => props.gradientDirection},
    ${(props) => props.theme.palette.brand25},
    rgba(0, 0, 0, 0)
  );
`;

const ProfileWrapper = styled.div`
  margin: 0 auto;
  padding-bottom: 3rem;
  width: 50%;
  z-index: ${(props) => props.theme.zIndexes.up};
`;

const RightAlign = styled.div`
  text-align: right;
  display: flex;
  justify-content: flex-end;
  flex-direction: row;
  flex-grow: 0;
  ${(props) => (props.hidden ? 'visibility: hidden;' : '')};
`;

const LeftMargin = styled.div`
  margin-left: 1rem;
  color: ${(props) => props.theme.palette.brand};
`;

const SectionHeader = styled(LeftMargin)`
  ${(props) => props.theme.typography.fonts.fontHeading};
  font-size: 1.2rem;
`;

const DiscordMetricsContainer = styled(FlexStyled)`
  width: auto;
`;

export default withWallet(Account);
