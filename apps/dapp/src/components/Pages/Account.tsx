//@ts-nocheck
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AccessoriesTemplate from 'components/Accessories/AccessoriesTemplate';
import BackButton from 'components/Button/BackButton';
import EnclaveCard from 'components/EnclaveCard/EnclaveCard';
import { FlexStyled } from 'components/Layout/Flex';
import ProfileHeader from 'components/ProfileHeader/ProfileHeader';
import ProfileMetric from 'components/ProfileMetric/ProfileMetric';
import withWallet from 'hoc/withWallet';
import { CustomRoutingPageProps } from 'hooks/use-custom-spa-routing';
import useFetchStoreDiscordUser from 'hooks/use-fetch-store-discord-user';
import useRefreshableAccountMetrics from 'hooks/use-refreshable-account-metrics';
import { FAITH_TOKEN, useWallet } from 'providers/WalletProvider';
import styled from 'styled-components';
import { formatNumberWithCommas } from 'utils/formatter';

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

const ENV_VARS = import.meta.env;
const BACKEND_URL = ENV_VARS.VITE_BACKEND_URL

const Account = ({ routingHelper }: CustomRoutingPageProps) => {
  const { back } = routingHelper;

  const { faith } = useWallet();
  const [discordData, setDiscordData] = useState<DiscordUser>();
  const discordId = useFetchStoreDiscordUser();
  const accountMetrics = useRefreshableAccountMetrics();

  useEffect(() => {
    const getDiscordUser = async (
      userId?: string
    ): Promise<DiscordUser | null> => {
      if (!userId) {
        return;
      }
      const response = await axios({
        url: `${BACKEND_URL}/api/discord/members/${userId}`,
      });
      setDiscordData(response?.data);
    };
    getDiscordUser(discordId);
  }, [discordId, setDiscordData]);

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
                          value={`$${formatNumberWithCommas(
                            accountMetrics.netWorth
                          )}`}
                          fontSize={1.5}
                        />
                      </div>
                      <SectionHeader>Unstaked (TEMPLE)</SectionHeader>
                      <div>
                        <ProfileMetric
                          label={'wallet'}
                          value={`${formatNumberWithCommas(
                            accountMetrics.templeBalance
                          )} TEMPLE`}
                          detail={`$${formatNumberWithCommas(
                            accountMetrics.walletValue
                          )}`}
                        />
                        <ProfileMetric
                          label={`Exit Queue`}
                          value={`${formatNumberWithCommas(
                            accountMetrics.exitQueueTotal
                          )} TEMPLE`}
                          detail={`$${formatNumberWithCommas(
                            accountMetrics.exitQueueValue
                          )}`}
                        />
                      </div>
                    </div>
                    <div>
                      <SectionHeader>Staked (OGTEMPLE)</SectionHeader>
                      <LeftMargin>{`(${accountMetrics.templeApy}% APY)`}</LeftMargin>
                      <div>
                        <ProfileMetric
                          label={'wallet'}
                          value={`${formatNumberWithCommas(
                            accountMetrics.ogTempleWallet
                          )} OGTEMPLE`}
                          detail={`$${formatNumberWithCommas(
                            accountMetrics.ogTempleWalletValue
                          )}`}
                        />
                      </div>
                      <div>
                        <ProfileMetric
                          label={`Locked`}
                          value={`${formatNumberWithCommas(
                            accountMetrics.lockedOGTemple
                          )} OGTEMPLE`}
                          detail={`$${formatNumberWithCommas(
                            accountMetrics.lockedOGTempleValue
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
                    <ProfileMetric label={'faith'} value={''} fontSize={1.5} />
                  </RightAlign>
                  <RightAlign>
                    <ProfileMetric
                      label={`lifetime`}
                      value={`${formatNumberWithCommas(faith.lifeTimeFaith)}  ${FAITH_TOKEN}`}
                    />
                    <ProfileMetric
                      label={`usable`}
                      value={`${formatNumberWithCommas(faith.usableFaith)} ${FAITH_TOKEN}`}
                    />
                  </RightAlign>
                  <RightAlign>
                    <ProfileMetric label={`share`} value={` ${faith.share}%`} />
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
                      enclave={discordData?.enclave?.toLowerCase()}
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
                enclave={discordData?.enclave?.toLowerCase()}
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
