//@ts-nocheck

import React, { useEffect, useState } from 'react';
import BackButton from 'components/Button/BackButton';
import ProfileHeader from 'components/ProfileHeader/ProfileHeader';
import AccessoriesTemplate from 'components/Accessories/AccessoriesTemplate';
import ProfileMetric from 'components/ProfileMetric/ProfileMetric';
import Image from 'components/Image/Image';
import EnclaveCard from 'components/EnclaveCard/EnclaveCard';
import styled from 'styled-components';
import { FlexStyled } from 'components/Layout/Flex';
import withWallet from 'hoc/withWallet';
import { useWallet } from 'providers/WalletProvider';
import leftImage from 'assets/images/dashboard-2.png';
import useRefreshableAccountMetrics from 'hooks/use-refreshable-account-metrics';
import useFetchStoreDiscordUser from 'hooks/use-fetch-store-discord-user';
import { formatNumber, formatNumberWithCommas } from 'utils/formatter';
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

  const { wallet } = useWallet();
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
  const lockedTemple =
    accountMetrics?.lockedOGTempleBalance * accountMetrics?.ogTempleRatio;
  const lockedTempleValue =
    accountMetrics?.lockedOGTempleBalance * accountMetrics?.ogTemplePrice;
  const stakedTemple =
    accountMetrics?.OGTempleBalance * accountMetrics?.ogTempleRatio;
  const stakedTempleValue =
    accountMetrics?.OGTempleBalance * accountMetrics?.ogTemplePrice;
  const netWorthTemple =
    stakedTemple + lockedTemple + accountMetrics?.templeBalance;
  const netWorth = stakedTempleValue + lockedTempleValue + walletValue;

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
                          value={`${formatNumberWithCommas(
                            netWorthTemple
                          )} TEMPLE`}
                          detail={`$${formatNumberWithCommas(netWorth)}`}
                        />
                        <ProfileMetric
                          label={'wallet'}
                          value={`${formatNumberWithCommas(
                            accountMetrics?.templeBalance
                          )} TEMPLE`}
                          detail={`$${formatNumberWithCommas(walletValue)}`}
                        />
                      </div>
                      <div>
                        <ProfileMetric
                          label={`Staked & Unlocked`}
                          value={`${formatNumberWithCommas(
                            stakedTemple
                          )} TEMPLE`}
                          detail={`$${formatNumberWithCommas(
                            stakedTempleValue
                          )} (${accountMetrics?.templeApy}% APY)`}
                        />
                      </div>
                      <div>
                        <ProfileMetric
                          label={`Staked & Locked`}
                          value={`${formatNumberWithCommas(
                            lockedTemple
                          )} TEMPLE`}
                          detail={`$${formatNumberWithCommas(
                            lockedTempleValue
                          )} (${accountMetrics?.templeApy}% APY)`}
                        />
                      </div>
                      <div>
                        <ProfileMetric
                          label={'net sacrificed'}
                          value={`${formatNumberWithCommas(
                            accountMetrics.totalSacrificed
                          )} FRAX`}
                        />
                      </div>
                      <div>
                        <CardStyled>
                          <MoneyImage src={leftImage} />
                        </CardStyled>
                      </div>
                    </div>
                    <div></div>
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
                    <ProfileMetric label={'faith'} value={`0 FAITH`} />
                    <ProfileMetric label={'faith power'} value={`0%`} />
                  </RightAlign>
                  <RightAlign>
                    <ProfileMetric label={'faith share'} value={`0%`} />
                    <ProfileMetric label={'temple share'} value={`0%`} />
                  </RightAlign>
                </div>
                <div>
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
                </div>
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

const CardStyled = styled.div<CardWrapperProps>`
  position: relative;
  border: 1px solid ${(props) => props.theme.palette.brand50};
  border-radius: 50%;
  width: 12rem;
  overflow: hidden;
`;

const MoneyImage = styled(Image)`
  height: 12rem;
  width: 100%;
  transform: scale(1.2);
`;

export default withWallet(Account);
