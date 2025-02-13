import { useConnectWallet } from '@web3-onboard/react';
import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useWallet } from 'providers/WalletProvider';
import linkSvg from 'assets/icons/link.svg?react';
import { EarnTopNav } from 'components/Pages/Core/DappPages/SpiceBazaar/Earn/TopNav';
import { Button } from 'components/Button/Button';
import wallet from 'assets/icons/wallet.svg?react';
import { useSpiceBazaar } from 'providers/SpiceBazaarProvider';
import Loader from 'components/Loader/Loader';
import { formatNumberWithCommas } from 'utils/formatter';
import * as breakpoints from 'styles/breakpoints';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';

type ItemProps = {
  isActive: boolean;
};

enum StakeTempleLocPaths {
  Stake = '/dapp/spice/earn/staketemple/stake',
  Unstake = '/dapp/spice/earn/staketemple/unstake',
  Claim = '/dapp/spice/earn/staketemple/claim',
}

const items = [
  {
    label: 'STAKE',
    linkTo: StakeTempleLocPaths.Stake,
  },
  {
    label: 'UNSTAKE',
    linkTo: StakeTempleLocPaths.Unstake,
  },
  {
    label: 'CLAIM TGLD',
    linkTo: StakeTempleLocPaths.Claim,
  },
];

export const StakeTemple = () => {
  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });

  const [activeTab, setActiveTab] = useState<StakeTempleLocPaths>(
    StakeTempleLocPaths.Stake
  );
  const navigate = useNavigate();
  const loc = useLocation();

  const [{}, connect] = useConnectWallet();
  const { wallet } = useWallet();

  const { stakePageMetrics } = useSpiceBazaar();

  const {
    data: stakePageMetricsData,
    loading: stakePageMetricsLoading,
    fetch: fetchStakePageMetrics,
  } = stakePageMetrics;

  useEffect(() => {
    const onMount = async () => {
      await fetchStakePageMetrics();
    };
    onMount();
  }, [fetchStakePageMetrics, wallet]);

  useEffect(() => {
    if (loc.pathname) {
      setActiveTab(loc.pathname as StakeTempleLocPaths);
    }
  }, [loc.pathname]);

  const handleTabClick = (linkTo: string) => {
    setActiveTab(linkTo as StakeTempleLocPaths);
    navigate(linkTo.toLowerCase());
  };

  return (
    <PageContainer>
      <EarnTopNav />
      <BodyContainer>
        <ContainerTop>
          <Header>
            <HeaderTitle>
              Stake TEMPLE
              <LinkIcon
                onClick={() =>
                  window.open(
                    'https://docs.templedao.link/spice-bazaar',
                    '_blank',
                    'noreferrer'
                  )
                }
              />
            </HeaderTitle>
            <HeaderText>
              Stake your TEMPLE to receive Temple Gold (TGLD) weekly Epoch
              rewards. TEMPLE tokens that are currently being supplied in TLC{' '}
              cannot be staked. Newly staked TEMPLE have a cooldown period
              before they can be unstaked. Claimed TGLD can be used in a current
              or future Spice Auction.
            </HeaderText>
          </Header>
          <StatusContainer>
            <BoxContainer>
              <Box>
                {stakePageMetricsLoading ? (
                  <Loader iconSize={32} />
                ) : (
                  <>
                    <Sum>
                      {formatNumberWithCommas(
                        stakePageMetricsData.stakedTemple
                      )}
                      &nbsp;TEMPLE
                    </Sum>
                    <Title>Total Staked</Title>
                  </>
                )}
              </Box>
              <Box>
                {stakePageMetricsLoading ? (
                  <Loader iconSize={32} />
                ) : (
                  <>
                    <Sum>
                      {formatNumberWithCommas(
                        stakePageMetricsData.circulatingSupply
                      )}
                      &nbsp;TGLD
                    </Sum>
                    <Title>Circulating Supply</Title>
                  </>
                )}
              </Box>
              <Box>
                {stakePageMetricsLoading ? (
                  <Loader iconSize={32} />
                ) : (
                  <>
                    <Sum>
                      {formatNumberWithCommas(
                        stakePageMetricsData.totalEpochRewards
                      )}
                      &nbsp;TGLD
                    </Sum>
                    <Title>Total EPOCH Rewards</Title>
                  </>
                )}
              </Box>
            </BoxContainer>
            <BoxContainer>
              <Box>
                {stakePageMetricsLoading ? (
                  <Loader iconSize={32} />
                ) : (
                  <>
                    <Sum>
                      {formatNumberWithCommas(stakePageMetricsData.yourStake)}
                      &nbsp;TEMPLE
                    </Sum>
                    <Title>
                      Your Stake{' '}
                      {stakePageMetricsData.yourStake > 0 && (
                        <>
                          (
                          {(
                            (stakePageMetricsData.yourStake /
                              stakePageMetricsData.stakedTemple) *
                            100
                          ).toFixed(2)}
                          % of total)
                        </>
                      )}
                    </Title>
                  </>
                )}
              </Box>
              <Box>
                {stakePageMetricsLoading ? (
                  <Loader iconSize={32} />
                ) : (
                  <>
                    <Sum>2,694&nbsp;TGLD</Sum>
                    <Title>Expected daily TGLD vest</Title>
                  </>
                )}
              </Box>
              <Box>
                {stakePageMetricsLoading ? (
                  <Loader iconSize={32} />
                ) : (
                  <>
                    <Sum>
                      {formatNumberWithCommas(stakePageMetricsData.yourRewards)}
                      &nbsp;TGLD
                    </Sum>
                    <Title>Claimable Rewards</Title>
                  </>
                )}
              </Box>
            </BoxContainer>
          </StatusContainer>
        </ContainerTop>
        <ContainerBottom>
          <Nav>
            {items.map((item) => (
              <Item
                key={item?.label}
                isActive={activeTab === item?.linkTo}
                onClick={() => handleTabClick(item.linkTo)}
              >
                <ItemText>{item?.label}</ItemText>
              </Item>
            ))}
          </Nav>
          <OutletContainer wallet={wallet}>
            {wallet ? (
              <Outlet />
            ) : (
              <TradeButton
                onClick={() => {
                  connect();
                }}
                style={{ margin: 'auto', whiteSpace: 'nowrap' }}
              >
                <WalletIcon />
                Connect Wallet
              </TradeButton>
            )}
          </OutletContainer>
        </ContainerBottom>
      </BodyContainer>
    </PageContainer>
  );
};

const PageContainer = styled.div`
  margin-top: -60px;

  ${breakpoints.phoneAndAbove(`
    margin-top: -20px;
  `)}
`;

const BodyContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 0px 40px 0px;

  ${breakpoints.phoneAndAbove(`
    gap: 60px;
    padding: 40px 0px 0px 0px;
  `)}
`;

const ContainerTop = styled.div`
  display: flex;
  flex-direction: column;
  gap: 40px;
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const LinkIcon = styled(linkSvg)`
  fill: ${({ theme }) => theme.palette.brand};
  cursor: pointer;
`;

const HeaderTitle = styled.h2`
  display: flex;
  align-items: center;
  text-align: center;
  color: ${({ theme }) => theme.palette.brandLight};
  gap: 15px;
  margin: 0px;
  font-size: 28px;
  line-height: 52px;

  ${breakpoints.phoneAndAbove(`
  font-size: 36px;
  line-height: 67px;
`)}
`;

const HeaderText = styled.div`
  font-weight: 700;
  color: ${({ theme }) => theme.palette.brand};
  font-size: 16px;
  line-height: 19px;

  ${breakpoints.phoneAndAbove(`
    font-size: 18px;
    line-height: 22px;
`)}
`;

const StatusContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const BoxContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;

  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
  `)}
`;

const Box = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  flex-basis: 0;
  min-height: 136px;
  gap: 12px;
  padding: 10px;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  border-radius: 10px;
  background: linear-gradient(
    to bottom,
    #0b0a0a,
    #1d1a1a
  ); //it is lighter than the grey from theme.palette
`;

const Title = styled.div`
  font-size: 16px;
  line-height: 19px;
  color: ${({ theme }) => theme.palette.brand};
`;

const Sum = styled.div`
  font-size: 24px;
  font-weight: 700;
  line-height: 29px;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const ContainerBottom = styled.div`
  border: 1px solid ${({ theme }) => theme.palette.brand};
  border-radius: 10px;
  gap: 60px;
`;

const Nav = styled.nav`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-around;
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
`;

const Item = styled.button<ItemProps>`
  white-space: nowrap;
  overflow: hidden;
  flex-grow: 1;
  flex-basis: 0;
  cursor: pointer;
  background: ${(props) =>
    props.isActive
      ? ({ theme }) => theme.palette.gradients.greyVertical
      : 'none'};
  border: none;

  &:first-child {
    border-right: none;
    border-radius: 9px 0 0 0;
    padding: 15px 0px 15px 0px;
  }

  &:last-child {
    border-left: none;
    border-radius: 0 9px 0 0;
    padding: 15px 0px 15px 0px;
  }

  &:not(:first-child):not(:last-child) {
    border-left: 1px solid ${({ theme }) => theme.palette.brand};
    border-right: 1px solid ${({ theme }) => theme.palette.brand};
    padding: 15px 0px 15px 0px;
  }

  ${breakpoints.phoneAndAbove(`
    padding: 15px 40px 15px 40px;
  `)}
`;

const ItemText = styled.p`
  margin: 0px;
  color: ${({ theme }) => theme.palette.brandLight};
  // text-align: center;
  font-size: 14px;
  line-height: 24px;

  ${breakpoints.phoneAndAbove(`
    font-size: 16px;
    line-height: 19px;
`)}
`;

const OutletContainer = styled.div<{ wallet?: string }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: ${({ wallet }) => (wallet === undefined ? '166px' : 'auto')};
`;

const WalletIcon = styled(wallet)`
  min-width: 24px;
  min-height: 24px;
`;

const TradeButton = styled(Button)`
  padding: 12px 20px 12px 20px;
  width: ${(props) => props.width || 'min-content'};
  height: min-content;
  background: linear-gradient(90deg, #58321a 20%, #95613f 84.5%);
  border: 1px solid ${({ theme }) => theme.palette.brandDark};
  box-shadow: 0px 0px 20px 0px #de5c0666;
  border-radius: 10px;
  font-size: 16px;
  line-height: 20px;
  font-weight: 700;
  text-transform: uppercase;
  color: ${({ theme }) => theme.palette.brandLight};

  /* Flex settings for centering button content */
  display: flex;
  align-items: center;
  justify-content: center;

  /* Flex settings for the span inside the button */
  & > span {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }
`;
