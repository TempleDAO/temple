import { EarnTopNav } from 'components/Pages/Core/DappPages/SpiceBazaar/Earn/TopNav';
import linkSvg from 'assets/icons/link.svg?react';
import active from 'assets/icons/active.svg?react';
import scheduled from 'assets/icons/scheduled.svg?react';
import styled from 'styled-components';
import { useEffect, useState } from 'react';
import { Chart } from './Chart/Chart';
import { BidUSDS, BidUSDSMode } from './BidUSDS';
import { Popover } from 'components/Pages/Core/DappPages/SpiceBazaar/components/Popover';
import { AuctionsHistory } from './AuctionsHistoryTable/Table';
import { useSpiceBazaar } from 'providers/SpiceBazaarProvider';
import {
  formatNumberWithCommas,
  formatNumberAbbreviated,
} from 'utils/formatter';
import Loader from 'components/Loader/Loader';
import * as breakpoints from 'styles/breakpoints';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';
import { useWallet } from 'providers/WalletProvider';
import { useConnectWallet } from '@web3-onboard/react';
import wallet from 'assets/icons/wallet.svg?react';
import { Button } from 'components/Button/Button';
import { BidHistory } from 'components/Pages/Core/DappPages/SpiceBazaar/Earn/Auctions/BidHistoryTable/Table';
import { useAuctionCountdown } from 'hooks/spicebazaar/use-auction-countdown';

const DEVMODE_QUERY_PARAM = 'devmode';

export const Auctions = () => {
  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });
  const [modal, setModal] = useState<'closed' | 'bidDai'>('closed');
  const [modalMode, setModalMode] = useState<BidUSDSMode>(BidUSDSMode.Bid);

  const [{}, connect] = useConnectWallet();
  const { wallet } = useWallet();

  const {
    daiGoldAuctionInfo: {
      data: daiGoldAuctionInfo,
      fetch: fetchDaiGoldAuctionInfo,
      loading: daiGoldAuctionInfoLoading,
    },
    currentUser: {
      data: currentUserInfo,
      fetch: fetchCurrentUserInfo,
      loading: currentUserInfoLoading,
    },
  } = useSpiceBazaar();

  const countdown = useAuctionCountdown();

  useEffect(() => {
    const fetchData = async () => {
      await fetchDaiGoldAuctionInfo();
    };
    fetchData();
  }, [wallet]);

  useEffect(() => {
    const fetchData = async () => {
      await fetchCurrentUserInfo();
    };
    fetchData();
  }, [wallet]);

  const [showChart, setShowChart] = useState(false);

  return (
    <>
      <PageContainer>
        <EarnTopNav />
        <ContentContainer>
          <DaiGoldAuctions>
            <DaiGold>
              <DaiGoldTitle>
                USDS GOLD Auctions
                <LinkIcon
                  onClick={() =>
                    window.open(
                      'https://docs.templedao.link/spice-bazaar',
                      '_blank',
                      'noreferrer'
                    )
                  }
                />
              </DaiGoldTitle>
              <DaiGoldText>
                In a Temple Gold Auction, you can earn Temple Gold (TGLD) by
                submitting USDS Bids even if you do not hold any TEMPLE. Once
                placed, USDS Bids cannot be withdrawn, but you may enter
                additional Bids. The more USDS you bid, the more TGLD you will
                earn. However, the final TGLD unit price for a given Auction
                will not be known until the last Bid has been entered and may be
                higher or lower than in previous Auctions.
              </DaiGoldText>
            </DaiGold>
            <CurrentAuction>
              <Header>
                <HeaderLeft>
                  <CurrentAuctionTitle>
                    {daiGoldAuctionInfo?.currentEpochAuctionLive
                      ? 'Current Auction'
                      : 'Next Auction'}
                  </CurrentAuctionTitle>
                  {daiGoldAuctionInfoLoading ? (
                    <Loader iconSize={32} />
                  ) : (
                    <Epoch
                      onClick={() => {
                        if (
                          window.location.search.includes(DEVMODE_QUERY_PARAM)
                        ) {
                          setShowChart(!showChart);
                        }
                      }}
                    >
                      EPOCH{' '}
                      {daiGoldAuctionInfo?.currentEpochAuctionLive
                        ? daiGoldAuctionInfo?.currentEpoch
                        : daiGoldAuctionInfo?.nextEpoch}
                    </Epoch>
                  )}
                </HeaderLeft>
                <HeaderRight>
                  <HeaderRightContainer
                    isLive={daiGoldAuctionInfo?.currentEpochAuctionLive}
                  >
                    {daiGoldAuctionInfoLoading ? (
                      <Loader iconSize={32} />
                    ) : daiGoldAuctionInfo?.currentEpochAuctionLive ? (
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
              {daiGoldAuctionInfo?.currentEpochAuctionLive && (
                <ButtonContainer>
                  {wallet ? (
                    currentUserInfoLoading ? (
                      <Loader iconSize={32} />
                    ) : currentUserInfo?.currentEpochBidAmount ? (
                      <TradeButton
                        onClick={() => {
                          setModal('bidDai');
                          setModalMode(BidUSDSMode.IncreaseBid);
                        }}
                        style={{ whiteSpace: 'nowrap', margin: 0 }}
                      >
                        INCREASE BID
                      </TradeButton>
                    ) : (
                      <TradeButton
                        onClick={() => {
                          setModal('bidDai');
                          setModalMode(BidUSDSMode.Bid);
                        }}
                        style={{ whiteSpace: 'nowrap', margin: 0 }}
                      >
                        BID USDS FOR TGLD
                      </TradeButton>
                    )
                  ) : (
                    <TradeButton
                      onClick={() => {
                        connect();
                      }}
                      style={{ margin: 0, whiteSpace: 'nowrap' }}
                    >
                      <WalletIcon />
                      Connect Wallet
                    </TradeButton>
                  )}
                </ButtonContainer>
              )}
              {(daiGoldAuctionInfo?.currentEpochAuctionLive || showChart) && (
                <>
                  <Status>
                    <StatusContent>
                      {daiGoldAuctionInfoLoading ? (
                        <Loader iconSize={32} />
                      ) : (
                        <>
                          <StatusTitle>Price Ratio</StatusTitle>
                          <StatusValue>
                            1 TLGD ={' '}
                            {daiGoldAuctionInfo?.priceRatio < 0.01
                              ? '<0.01'
                              : daiGoldAuctionInfo?.priceRatio.toFixed(4)}{' '}
                            USDS
                          </StatusValue>
                          <StatusLink
                            href="#auction-history"
                            onClick={(e) => {
                              e.preventDefault();
                              document
                                .getElementById('auction-history')
                                ?.scrollIntoView({
                                  behavior: 'smooth',
                                });
                            }}
                          >
                            View history
                          </StatusLink>
                        </>
                      )}
                    </StatusContent>
                    <StatusContent>
                      {daiGoldAuctionInfoLoading ? (
                        <Loader iconSize={32} />
                      ) : (
                        <>
                          <StatusTitle>Amount to be auctioned</StatusTitle>
                          <StatusValue>
                            {
                              formatNumberAbbreviated(
                                daiGoldAuctionInfo?.totalAuctionTokenAmount
                              ).string
                            }{' '}
                            TGLD
                          </StatusValue>
                        </>
                      )}
                    </StatusContent>
                    <StatusContent>
                      {daiGoldAuctionInfoLoading ? (
                        <Loader iconSize={32} />
                      ) : (
                        <>
                          <StatusTitle>Amount submitted</StatusTitle>
                          <StatusValue>
                            {formatNumberWithCommas(
                              daiGoldAuctionInfo?.totalBidTokenAmount
                            )}{' '}
                            USDS
                          </StatusValue>
                        </>
                      )}
                    </StatusContent>
                  </Status>
                  <ChartContainer>
                    <ChartTitle>TGLD BID HISTORY</ChartTitle>
                    <Chart auctionInfo={daiGoldAuctionInfo} />
                  </ChartContainer>
                  <TableContainer>
                    <BidHistory auctionInfo={daiGoldAuctionInfo} />
                  </TableContainer>
                </>
              )}
            </CurrentAuction>
          </DaiGoldAuctions>
          <AuctionsHistoryContainer id="auction-history">
            <AuctionsHistory />
          </AuctionsHistoryContainer>
        </ContentContainer>
      </PageContainer>
      <Popover
        isOpen={modal != 'closed'}
        onClose={() => setModal('closed')}
        closeOnClickOutside
        showCloseButton
      >
        <BidUSDS
          mode={modalMode}
          onBidSubmitted={() => setModal('closed')}
          currentBidAmount={currentUserInfo?.currentEpochBidAmount.toString()}
        />
      </Popover>
    </>
  );
};

const LinkIcon = styled(linkSvg)`
  fill: ${({ theme }) => theme.palette.brand};
  cursor: pointer;
`;

const PageContainer = styled.div`
  margin-top: -60px;

  ${breakpoints.phoneAndAbove(`
    margin-top: -20px;
  `)}
`;

const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 0px 40px 0px;

  ${breakpoints.phoneAndAbove(`
    gap: 60px;
    padding: 40px 0px 0px 0px;
  `)}
`;

const DaiGoldAuctions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;

  ${breakpoints.phoneAndAbove(`
    gap: 60px;
  `)}
`;

const DaiGold = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const DaiGoldTitle = styled.h2`
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

const DaiGoldText = styled.div`
  font-weight: 700;
  color: ${({ theme }) => theme.palette.brand};
  font-size: 16px;
  line-height: 19px;

  ${breakpoints.phoneAndAbove(`
    font-size: 18px;
    line-height: 22px;
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

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 20px;
  flex-direction: column;

  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
  `)}
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
`;

const HeaderRight = styled.div`
  display: flex;
  justify-content: center;

  ${breakpoints.phoneAndAbove(`
    gap: 12px;
    justify-content: flex-end;;
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
  padding: 16px 24px 16px 24px;
  gap: 10px;
  width: 305px;

  ${breakpoints.phoneAndAbove(`
    width: 250px;
    padding: 8px 24px 8px 24px;
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
  flex-shrink: 0;
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

const Epoch = styled.div`
  display: flex;
  white-space: nowrap;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  border-radius: 10px;
  padding: 8px;
  background: ${({ theme }) => theme.palette.black};
  gap: 10px;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  color: ${({ theme }) => theme.palette.brand};
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
  width: 305px;
  white-space: nowrap;
  border: solid 1px ${({ theme }) => theme.palette.brand};
  border-radius: 10px;
  background: ${({ theme }) => theme.palette.black};
  padding: 20px 10px 20px 10px;
  gap: 12px;
  margin: auto;

  ${breakpoints.phoneAndAbove(`
    min-width: 250px;
    max-width: 50%;
  `)}
`;

const StatusTitle = styled.p`
  margin: 0px;
  font-size: 16px;
  line-height: 19px;
  text-align: center;
  color: ${({ theme }) => theme.palette.brand};
`;

const StatusValue = styled.p`
  margin: 0px;
  font-size: 24px;
  font-weight: 700;
  line-height: 29px;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const StatusLink = styled.a`
  margin: 0px;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
  text-decoration: underline;
  color: ${({ theme }) => theme.palette.brand};
`;

const ChartContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 20px 20px 20px 20px;
  gap: 40px;
  background: ${({ theme }) => theme.palette.black};
  border: 1px solid ${({ theme }) => theme.palette.brand};
  border-radius: 10px;
`;

const ChartTitle = styled.div`
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 16px;
  line-height: 19px;
  margin-left: 5px;

  ${breakpoints.phoneAndAbove(`
    margin-left: 20px;
  `)}
`;

const TableContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 20px 20px 20px 20px;
  gap: 40px;
  background: ${({ theme }) => theme.palette.black};
  border: 1px solid ${({ theme }) => theme.palette.brand};
  border-radius: 10px;
`;

const AuctionsHistoryContainer = styled.div``;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;

  ${breakpoints.phoneAndAbove(`
    justify-content: flex-start;  
  `)}
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
