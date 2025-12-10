import active from 'assets/icons/active.svg?react';
import scheduled from 'assets/icons/scheduled.svg?react';
import styled from 'styled-components';
import { useEffect, useState, useMemo } from 'react';
import { Button } from 'components/Button/Button';
import { Chart } from '../Chart/Chart';
import { BidTGLD, BidTGLDMode } from '../BidTGLD';
import { Popover } from 'components/Pages/Core/DappPages/SpiceBazaar/components/Popover';
import * as breakpoints from 'styles/breakpoints';
import { Link, useParams } from 'react-router-dom';
import arrowBack from 'assets/icons/arrow_back.svg?react';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';
import {
  SpiceAuctionInfo,
  useSpiceAuction,
} from 'providers/SpiceAuctionProvider';
import env from 'constants/env';
import { useSpiceAuctionCountdown } from 'hooks/spicebazaar/use-spice-auction-countdown';
import Loader from 'components/Loader/Loader';
import { DEVMODE_QUERY_PARAM } from '../../Bid';
import { useAuctionUserMetrics } from 'components/Pages/Core/DappPages/SpiceBazaar/Spend';
import { useWallet } from 'providers/WalletProvider';
import { formatNumberWithCommasAndDecimals } from 'utils/formatter';

export const Details = () => {
  // get the address from the path
  const { address } = useParams();
  const { wallet } = useWallet();

  const {
    allSpiceAuctions: {
      fetch: fetchAllSpiceAuctions,
      data: allSpiceAuctionsData,
      loading: allSpiceAuctionsLoading,
    },
  } = useSpiceAuction();

  const [modal, setModal] = useState<{
    type: 'closed' | 'bidTgld' | 'bridgeTgld';
    auction?: SpiceAuctionInfo;
    currentBidAmount?: string;
  }>({ type: 'closed' });
  const [modalMode, setModalMode] = useState<BidTGLDMode>(BidTGLDMode.Bid);

  const auction = useMemo(
    () => allSpiceAuctionsData.find((auction) => auction.address === address),
    [allSpiceAuctionsData, address]
  );

  // Get user metrics for the selected auction
  const {
    data: userMetrics,
    refetch: refetchUserMetrics,
    isLoading: userMetricsLoading,
  } = useAuctionUserMetrics(auction?.address, wallet);

  useEffect(() => {
    fetchAllSpiceAuctions();
  }, [fetchAllSpiceAuctions]);

  const onOpenBidModal = async (
    auction: SpiceAuctionInfo,
    mode: BidTGLDMode
  ) => {
    // Set the modal first so the hook can use the auction address
    setModal({
      type: 'bidTgld',
      auction,
      currentBidAmount: userMetrics?.currentEpochBidAmount?.toString() || '0',
    });
    setModalMode(mode);
  };

  const shortenAddress = (address: string) => {
    if (!address || address.length < 16) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const [showChart, setShowChart] = useState(false);

  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });

  const countdown = useSpiceAuctionCountdown(auction || null);

  const MemoizedChart = useMemo(() => {
    if (!auction?.address) return null;
    return <Chart auctionAddress={auction.address} />;
  }, [auction?.address]);

  return (
    <>
      <PageContainer>
        <ContentContainer>
          <SpiceAuction>
            <BackLink to="/dapp/spice/spend">
              <ArrowBack />
              Back to all Spice Auctions
            </BackLink>
            <SpiceAuctionDetails>
              <SpiceAuctionTitle>{auction?.name} Auction</SpiceAuctionTitle>
              <CurrentAuction>
                <Header>
                  <HeaderLeft>
                    <Left>
                      {/* // TODO: Conditionally show "Next Auction" */}
                      <CurrentAuctionTitle>Current Auction</CurrentAuctionTitle>
                      <CurrentAddress>
                        <a
                          href={`${env.etherscan}/address/${auction?.address}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            all: 'unset',
                            cursor: 'pointer',
                            display: 'inline-block',
                          }}
                        >
                          {auction?.address
                            ? shortenAddress(auction.address)
                            : ''}
                        </a>
                      </CurrentAddress>
                    </Left>
                    <Right>
                      {allSpiceAuctionsLoading ? (
                        <Loader iconSize={32} />
                      ) : (
                        <Epoch
                          onClick={() => {
                            if (
                              window.location.search.includes(
                                DEVMODE_QUERY_PARAM
                              )
                            ) {
                              setShowChart(!showChart);
                            }
                          }}
                        >
                          <Text>EPOCH {auction?.currentEpoch}</Text>
                        </Epoch>
                      )}
                    </Right>
                  </HeaderLeft>
                  <HeaderRight>
                    <HeaderRightContainer
                      isLive={!!auction?.currentEpochAuctionLive}
                    >
                      {allSpiceAuctionsLoading ? (
                        <Loader iconSize={32} />
                      ) : auction?.currentEpochAuctionLive ? (
                        <>
                          <AuctionStatus>
                            <Active />
                            ACTIVE
                          </AuctionStatus>
                          <TimeStamp>Ends in {countdown}</TimeStamp>
                        </>
                      ) : (
                        <>
                          <AuctionStatus>
                            <Scheduled />
                            UPCOMING
                          </AuctionStatus>
                          {countdown && (
                            <TimeStamp>
                              {countdown === 'Starts soon'
                                ? countdown
                                : `Starts in ${countdown}`}
                            </TimeStamp>
                          )}
                        </>
                      )}
                    </HeaderRightContainer>
                  </HeaderRight>
                </Header>
                <ButtonsContainer>
                  {auction?.currentEpochAuctionLive &&
                    (userMetricsLoading ? (
                      <Loader iconSize={32} />
                    ) : userMetrics?.currentEpochBidAmount ? (
                      <TradeButton
                        onClick={() =>
                          onOpenBidModal(auction, BidTGLDMode.IncreaseBid)
                        }
                        style={{ whiteSpace: 'nowrap', margin: 0 }}
                      >
                        INCREASE BID
                      </TradeButton>
                    ) : (
                      <TradeButton
                        onClick={() => onOpenBidModal(auction, BidTGLDMode.Bid)}
                        style={{ whiteSpace: 'nowrap', margin: 0 }}
                      >
                        BID NOW
                      </TradeButton>
                    ))}
                </ButtonsContainer>
                {(auction?.currentEpochAuctionLive || showChart) && (
                  <>
                    <Status>
                      <StatusContent>
                        {allSpiceAuctionsLoading ? (
                          <Loader iconSize={32} />
                        ) : (
                          <>
                            <StatusTitle>Price Ratio</StatusTitle>
                            <StatusValue>
                              1 TOKEN ={' '}
                              {Number(auction?.priceRatio) < 0.01
                                ? '<0.01'
                                : auction?.priceRatio.toFixed(4)}{' '}
                              TGLD
                            </StatusValue>
                          </>
                        )}
                      </StatusContent>
                      <StatusContent>
                        {allSpiceAuctionsLoading ? (
                          <Loader iconSize={32} />
                        ) : (
                          <>
                            <StatusTitle>Amount to be auctioned</StatusTitle>
                            <StatusValue>
                              {auction?.totalAuctionTokenAmount}{' '}
                              {auction?.auctionTokenSymbol}
                            </StatusValue>
                          </>
                        )}
                      </StatusContent>
                      <StatusContent>
                        {allSpiceAuctionsLoading ? (
                          <Loader iconSize={32} />
                        ) : (
                          <>
                            <StatusTitle>Amount Submitted</StatusTitle>
                            <StatusValue>
                              {formatNumberWithCommasAndDecimals(
                                auction?.totalBidTokenAmount || 0,
                                0
                              )}{' '}
                              TGLD
                            </StatusValue>
                          </>
                        )}
                      </StatusContent>
                    </Status>
                    <ChartContainer>{MemoizedChart}</ChartContainer>
                  </>
                )}
              </CurrentAuction>
            </SpiceAuctionDetails>
          </SpiceAuction>
          {/* <AuctionsHistoryContainer id="auction-history"> // not in the MVP
            <AuctionsHistory />
          </AuctionsHistoryContainer> */}
        </ContentContainer>
      </PageContainer>
      <Popover
        isOpen={modal.type !== 'closed'}
        onClose={() => setModal({ type: 'closed' })}
        closeOnClickOutside
        showCloseButton
      >
        {modal.type === 'bidTgld' && (
          <BidTGLD
            mode={modalMode}
            auctionConfig={modal.auction?.staticConfig}
            currentBidAmount={modal.currentBidAmount}
            onBidSuccess={async () => {
              // Refetch all auction data to update metrics
              await fetchAllSpiceAuctions();
              // Refetch user metrics after bid success signalled by the provider
              await refetchUserMetrics();
              // Close modal after metrics are updated
              setModal({ type: 'closed' });
            }}
            isLoadingUserMetrics={userMetricsLoading}
          />
        )}
      </Popover>
    </>
  );
};

const PageContainer = styled.div`
  margin-top: -40px;
`;

const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 15px 40px 15px;

  ${breakpoints.phoneAndAbove(`
    gap: 80px;
    padding: 40px 0px 0px 0px;
  `)}
`;

const SpiceAuction = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const BackLink = styled(Link)`
  display: flex;
  flex-direction: row;
  font-size: 13px;
  font-weight: 700;
  line-height: 20px;
  text-decoration: underline;
  gap: 10px;
`;

const ArrowBack = styled(arrowBack)`
  width: 20px;
  height: 20px;
`;

const SpiceAuctionDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;

  ${breakpoints.phoneAndAbove(`
    gap: 40px;
  `)}
`;

const SpiceAuctionTitle = styled.h2`
  display: flex;
  align-items: center;
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

const CurrentAuction = styled.div`
  display: flex;
  flex-direction: column;
  border-top: solid ${({ theme }) => theme.palette.brandDark} 2px;
  border-bottom: solid ${({ theme }) => theme.palette.brandDark} 2px;
  background: ${({ theme }) => theme.palette.gradients.grey};
  padding: 24px;
  gap: 32px;
`;

const CurrentAddress = styled.div`
  font-size: 16px;
  line-height: 19px;
  color: ${({ theme }) => theme.palette.brandLight};
  text-decoration: underline;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 32px;
  flex-direction: column;

  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 20px;
  `)}
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 15px 0px;
`;

const Left = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Right = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;

  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
  `)}
`;

const HeaderRight = styled.div`
  display: flex;
  justify-content: center;

  ${breakpoints.phoneAndAbove(`
    gap: 12px;
    justify-content: flex-end;
  `)}
`;

const HeaderRightContainer = styled.div<{ isLive: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  background: ${({ theme }) => theme.palette.black};
  border: solid 1px;
  border-color: ${({ isLive }) => (isLive ? '#588f22' : '#EAB85B')};
  border-radius: 10px;
  padding: 16px 24px;
  gap: 10px;
  width: 305px;

  ${breakpoints.phoneAndAbove(`
    width: 240px;
    padding: 8px 24px;
  `)}
`;

const AuctionStatus = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  font-size: 16px;
  line-height: 19px;
  gap: 8px;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const TimeStamp = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 19px;
  text-align: center;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const Active = styled(active)``;

const Scheduled = styled(scheduled)``;

const CurrentAuctionTitle = styled.h3`
  display: flex;
  white-space: nowrap;
  font-size: 24px;
  line-height: 44px;
  text-align: left;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0px;
`;

const Text = styled.p`
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  color: ${({ theme }) => theme.palette.brand};
  margin: 0px;
  white-space: nowrap;
`;

const Epoch = styled.div`
  display: flex;
  align-items: center;
  padding: 8px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  background: ${({ theme }) => theme.palette.black};
`;

const Status = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;

  ${breakpoints.phoneAndAbove(`
    gap: 40px;
  `)}
`;

const StatusContent = styled.div`
  display: flex;
  flex: 1 1 30%;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 136px;
  min-width: 300px;
  white-space: nowrap;
  border: solid 1px ${({ theme }) => theme.palette.brand};
  border-radius: 10px;
  background: ${({ theme }) => theme.palette.black};
  padding: 20px 10px 20px 10px;
  gap: 12px;
  margin: auto;

  ${breakpoints.phoneAndAbove(`
    min-width: 300px;
    max-width: 50%;
  `)}
`;

const StatusTitle = styled.p`
  margin: 0px;
  font-size: 16px;
  line-height: 19px;
  text-align: center;
  text-wrap: balance;
  color: ${({ theme }) => theme.palette.brand};
`;

const StatusValue = styled.p`
  margin: 0px;
  font-size: 24px;
  font-weight: 700;
  line-height: 29px;
  text-align: center;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const ChartContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 270px;
  padding: 20px 20px 20px 20px;
  gap: 40px;
  background: ${({ theme }) => theme.palette.black};
  border: 1px solid ${({ theme }) => theme.palette.brand};
  border-radius: 10px;
`;

const ButtonsContainer = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  gap: 15px;

  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
    justify-content: left;
    width: 570px;
  `)}
`;

export const TradeButton = styled(Button)<{ gradient?: boolean }>`
  padding: 12px 20px 12px 20px;
  width: ${(props) => props.width || 'min-content'};
  height: min-content;
  background: ${({ theme, gradient }) =>
    gradient
      ? theme.palette.gradients.dark
      : 'linear-gradient(90deg, #58321A 20%, #95613F 84.5%)'};
  border: 1px solid ${({ theme }) => theme.palette.brandDark};
  box-shadow: 0px 0px 20px 0px #de5c0666;
  border-radius: 10px;
  font-size: 16px;
  line-height: 20px;
  font-weight: 700;
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
