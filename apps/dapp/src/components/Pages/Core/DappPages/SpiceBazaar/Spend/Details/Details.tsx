import active from 'assets/icons/active.svg?react';
import scheduled from 'assets/icons/scheduled.svg?react';
import closed from 'assets/icons/closed.svg?react';
import linkSvg from 'assets/icons/link.svg?react';
import { AuctionState, getAuctionState } from 'utils/spice-auction-state';
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
import { useTOSVerification } from 'hooks/spicebazaar/use-tos-verification';
import { formatNumberWithCommasAndDecimals } from 'utils/formatter';
import { SpiceBazaarTOS } from 'components/Pages/Core/DappPages/SpiceBazaar/components/SpiceBazaarTOS';

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
    type: 'closed' | 'bidTgld' | 'bridgeTgld' | 'spiceTos';
    auction?: SpiceAuctionInfo;
    currentBidAmount?: string;
    pendingBid?: { auction: SpiceAuctionInfo; mode: BidTGLDMode };
  }>({ type: 'closed' });
  const [modalMode, setModalMode] = useState<BidTGLDMode>(BidTGLDMode.Bid);
  const { isTOSSigned } = useTOSVerification();

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
    // Check if TOS has been signed
    if (!isTOSSigned(wallet)) {
      // Show TOS modal first, store the pending bid
      setModal({
        type: 'spiceTos',
        pendingBid: { auction, mode },
      });
      return;
    }

    // TOS already signed, proceed with bid modal
    setModal({
      type: 'bidTgld',
      auction,
      currentBidAmount: userMetrics?.currentEpochBidAmount?.toString() || '0',
    });
    setModalMode(mode);
  };

  const handleTOSSuccess = async () => {
    // TOS signed successfully, now open the bid modal with the pending bid
    if (modal.pendingBid) {
      const { auction, mode } = modal.pendingBid;
      await onOpenBidModal(auction, mode);
    }
  };

  const handleTOSCancel = () => {
    // User rejected TOS, close modal
    setModal({ type: 'closed' });
  };

  const shortenAddress = (address: string) => {
    if (!address || address.length < 16) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const [showChart, setShowChart] = useState(false);

  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });

  const { state } = useSpiceAuctionCountdown(auction || null);

  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return 'DD/MM/YYYY';
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTime = (timestamp: number | undefined) => {
    if (!timestamp) return '00:00';
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

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
              <SpiceAuctionTitle>
                {auction?.name} Auction Details
              </SpiceAuctionTitle>
              <CurrentAuction>
                <Header>
                  <HeaderLeft>
                    <Top>
                      {/* // TODO: Conditionally show "Next Auction" */}
                      {allSpiceAuctionsLoading ? (
                        <Loader iconSize={32} />
                      ) : (
                        <CurrentEpochNr>
                          Epoch {auction?.currentEpoch}
                        </CurrentEpochNr>
                      )}
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
                    </Top>
                    <Bottom>
                      <TokenPill
                        href={`${env.etherscan}/token/${auction?.staticConfig?.auctionToken?.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Text>{auction?.auctionTokenSymbol || 'ENA'} </Text>
                        <LinkIcon />
                      </TokenPill>
                      <TokenPill
                        href={`${env.etherscan}/token/${auction?.staticConfig?.templeGoldToken?.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Text>TGLD </Text>
                        <LinkIcon />
                      </TokenPill>
                    </Bottom>
                  </HeaderLeft>
                  <HeaderRight>
                    {allSpiceAuctionsLoading ? (
                      <Loader iconSize={32} />
                    ) : (
                      <>
                        <StatusBadge state={state}>
                          {state === AuctionState.LIVE ? (
                            <>
                              <Active />
                              ACTIVE
                            </>
                          ) : state === AuctionState.ENDED ? (
                            <>
                              <Closed />
                              ENDED
                            </>
                          ) : (
                            <>
                              <Scheduled />
                              UPCOMING
                            </>
                          )}
                        </StatusBadge>
                        <TimestampContainer>
                          <TimeStampRow>
                            <TimeStampLabel>Start</TimeStampLabel>
                            {state === AuctionState.LIVE ||
                            state === AuctionState.ENDED ? (
                              <>
                                <TimeStampDate>
                                  {formatDate(auction?.auctionStartTime)}
                                </TimeStampDate>
                                <TimeStampTime>
                                  {formatTime(auction?.auctionStartTime)}
                                </TimeStampTime>
                              </>
                            ) : auction?.nextAuctionStartTimestamp ? (
                              <>
                                <TimeStampDate>
                                  {formatDate(
                                    auction.nextAuctionStartTimestamp * 1000
                                  )}
                                </TimeStampDate>
                                <TimeStampTime>
                                  {formatTime(
                                    auction.nextAuctionStartTimestamp * 1000
                                  )}
                                </TimeStampTime>
                              </>
                            ) : (
                              <>
                                <TimeStampDate>TBD</TimeStampDate>
                                <TimeStampTime></TimeStampTime>
                              </>
                            )}
                          </TimeStampRow>
                          <TimeStampRow>
                            <TimeStampLabel>End</TimeStampLabel>
                            {state === AuctionState.LIVE ||
                            state === AuctionState.ENDED ? (
                              <>
                                <TimeStampDate>
                                  {formatDate(auction?.auctionEndTime)}
                                </TimeStampDate>
                                <TimeStampTime>
                                  {formatTime(auction?.auctionEndTime)}
                                </TimeStampTime>
                              </>
                            ) : (
                              <>
                                <TimeStampDate>TBD</TimeStampDate>
                                <TimeStampTime></TimeStampTime>
                              </>
                            )}
                          </TimeStampRow>
                        </TimestampContainer>
                      </>
                    )}
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
        closeOnClickOutside={modal.type !== 'spiceTos'}
        showCloseButton={modal.type !== 'spiceTos'}
      >
        {modal.type === 'spiceTos' && (
          <SpiceBazaarTOS
            onSuccess={handleTOSSuccess}
            onCancel={handleTOSCancel}
          />
        )}
        {modal.type === 'bidTgld' && (
          <BidTGLD
            mode={modalMode}
            auctionConfig={modal.auction?.staticConfig}
            currentBidAmount={modal.currentBidAmount}
            onBidSuccess={async () => {
              await fetchAllSpiceAuctions();
              await refetchUserMetrics();
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
  text-align: center;

  ${breakpoints.phoneAndAbove(`
    text-align: left;
  `)}
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 32px;

  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 20px;
  `)}
`;

const HeaderLeft = styled.div`
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 20px;
  padding: 15px 0px;

  ${breakpoints.phoneAndAbove(`
    width: 280px;
  `)}
`;

const Top = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: center;

  ${breakpoints.phoneAndAbove(`
    text-align: left;
  `)}
`;

const Bottom = styled.div`
  display: flex;
  flex-direction: row;
  gap: 8px;
`;

const HeaderRight = styled.div`
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 12px;
  align-items: stretch;

  ${breakpoints.phoneAndAbove(`
    width: 200px;
    gap: 12px;
    justify-content: flex-end;
  `)}
`;

const getStatusBadgeBorderColor = (state: AuctionState): string => {
  switch (state) {
    case AuctionState.LIVE:
      return '#588f22';
    case AuctionState.ENDED:
      return '#6B7280';
    case AuctionState.SCHEDULED:
    case AuctionState.NOT_SCHEDULED:
    default:
      return '#EAB85B';
  }
};

const StatusBadge = styled.div<{ state: AuctionState }>`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.palette.black};
  border: solid 1px;
  border-color: ${({ state }) => getStatusBadgeBorderColor(state)};
  border-radius: 10px;
  padding: 8px 24px;
  gap: 10px;
  font-size: 16px;
  line-height: 19px;
  color: ${({ theme }) => theme.palette.brandLight};
  width: 100%;

  ${breakpoints.phoneAndAbove(`
    padding: 8px 24px;
  `)}
`;

const TimestampContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
`;

const TimeStampRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.palette.black};
  border-radius: 10px;
  padding: 12px 14px;
  gap: 14px;
`;

const TimeStampLabel = styled.div`
  font-size: 14px;
  line-height: 17px;
  color: ${({ theme }) => theme.palette.brandLight};
  font-weight: 400;
`;

const TimeStampDate = styled.div`
  font-size: 14px;
  line-height: 17px;
  color: ${({ theme }) => theme.palette.brand};
  font-weight: 400;
`;

const TimeStampTime = styled.div`
  font-size: 14px;
  line-height: 17px;
  color: ${({ theme }) => theme.palette.brand};
  font-weight: 400;
  text-align: right;
`;

const Active = styled(active)``;

const Scheduled = styled(scheduled)``;

const Closed = styled(closed)``;

const CurrentEpochNr = styled.h3`
  display: flex;
  justify-content: center;
  white-space: nowrap;
  font-size: 20px;
  line-height: 32px;
  text-align: center;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0px;

  ${breakpoints.phoneAndAbove(`
    font-size: 24px;
    line-height: 44px;
    text-align: left;
    justify-content: flex-start;
  `)}
`;

const Text = styled.p`
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  color: ${({ theme }) => theme.palette.brand};
  margin: 0px;
  white-space: nowrap;
`;

const TokenPill = styled.a`
  display: flex;
  flex-grow: 1;
  align-items: center;
  justify-content: center;
  padding: 8px;
  gap: 8px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  background: ${({ theme }) => theme.palette.black};
  cursor: pointer;
  text-decoration: none;

  &:hover {
    background: ${({ theme }) => theme.palette.brandDarker};
  }

  &:focus {
    outline: 2px solid ${({ theme }) => theme.palette.brand};
    outline-offset: 2px;
  }
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
  flex: 1 1 100%;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 136px;
  min-width: 0;
  white-space: nowrap;
  border: solid 1px ${({ theme }) => theme.palette.brand};
  border-radius: 10px;
  background: ${({ theme }) => theme.palette.black};

  ${breakpoints.phoneAndAbove(`
    flex: 1 1 30%;
  `)}

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
  min-width: 0;
  padding: 20px 20px 20px 20px;
  gap: 40px;
  background: ${({ theme }) => theme.palette.black};
  border: 1px solid ${({ theme }) => theme.palette.brand};
  border-radius: 10px;

  ${breakpoints.phoneAndAbove(`
    min-width: 270px;
  `)}
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
  width: 100%;
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

  ${breakpoints.phoneAndAbove(`
    width: 280px;
  `)}

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

const LinkIcon = styled(linkSvg)`
  fill: ${({ theme }) => theme.palette.brand};
  cursor: pointer;
  width: 16px;
  height: 16px;
`;
