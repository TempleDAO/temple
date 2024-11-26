import { EarnTopNav } from 'components/Pages/Core/DappPages/SpiceBazaar/Earn/TopNav';
import linkSvg from 'assets/icons/link.svg?react';
import active from 'assets/icons/active.svg?react';
import scheduled from 'assets/icons/scheduled.svg?react';
import styled from 'styled-components';
import { useEffect, useState } from 'react';
import { TradeButton } from '../StakeTemple/Stake';
import { Chart } from './Chart/Chart';
import { BidDai } from './BidUSDS';
import { Popover } from 'components/Pages/Core/DappPages/SpiceBazaar/components/Popover';
import { AuctionsHistory } from './Table/Table';
import { useSpiceBazaar } from 'providers/SpiceBazaarProvider';
import { formatNumberWithCommas } from 'utils/formatter';
import Loader from 'components/Loader/Loader';
import * as breakpoints from 'styles/breakpoints';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';

export const Auctions = () => {
  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });
  const [isLive, setIsLive] = useState(true);
  const [modal, setModal] = useState<'closed' | 'bidDai'>('closed');

  const {
    daiGoldAuctionInfo: {
      data: daiGoldAuctionInfo,
      fetch: fetchDaiGoldAuctionInfo,
      loading: daiGoldAuctionInfoLoading,
    },
  } = useSpiceBazaar();

  useEffect(() => {
    const fetchData = async () => {
      await fetchDaiGoldAuctionInfo();
    };
    fetchData();
  }, [fetchDaiGoldAuctionInfo]);

  return (
    <>
      <PageContainer>
        <EarnTopNav />
        <ContentContainer>
          <DaiGoldAuctions>
            <DaiGold>
              <DaiGoldTitle>
                USDS GOLD Auctions
                <LinkIcon />
              </DaiGoldTitle>
              <DaiGoldText>
                In the USDS Gold Auction, submit your{' '}
                {!isPhoneOrAbove && <br />}
                USDS bid to win TGLD. The more you bid,{' '}
                {!isPhoneOrAbove && <br />}
                the more TGLD you will earn. Once {!isPhoneOrAbove && <br />}
                placed, Bids cannot be withdrawn, but{' '}
                {!isPhoneOrAbove && <br />}
                you can add more.
              </DaiGoldText>
            </DaiGold>
            <CurrentAuction>
              <Header>
                <HeaderLeft>
                  <CurrentAuctionTitle>Current Auction</CurrentAuctionTitle>
                  {daiGoldAuctionInfoLoading ? (
                    <Loader iconSize={32} />
                  ) : (
                    <Epoch>EPOCH {daiGoldAuctionInfo?.currentEpoch}</Epoch>
                  )}
                </HeaderLeft>
                <HeaderRight>
                  <HeaderRightContainer
                    isLive={isLive}
                    onClick={() => {
                      // TODO: Add logic to detect future auction live vs current live
                      setIsLive(!isLive);
                    }}
                  >
                    {daiGoldAuctionInfoLoading ? (
                      <Loader iconSize={32} />
                    ) : isLive ? (
                      <>
                        <AuctionStatus>
                          <Active />
                          ACTIVE
                        </AuctionStatus>
                        <TimeStamp>
                          Ends in{' '}
                          {new Date(
                            daiGoldAuctionInfo?.auctionEndTime
                          ).toLocaleString()}
                          {/* // TODO: Convert to countdown timer */}
                          {/* {00:15:03:04 at 07.07.24 23:59 CST} */}
                        </TimeStamp>
                      </>
                    ) : (
                      <>
                        <AuctionStatus>
                          <Scheduled />
                          UPCOMING
                        </AuctionStatus>
                        <TimeStamp>
                          Scheduled for 05.10.24 at 00:00 CST
                        </TimeStamp>
                      </>
                    )}
                  </HeaderRightContainer>
                </HeaderRight>
              </Header>
              <Status>
                <StatusContent>
                  {daiGoldAuctionInfoLoading ? (
                    <Loader iconSize={32} />
                  ) : (
                    <>
                      <StatusTitle>Price Ratio</StatusTitle>
                      <StatusValue>
                        1 TLGD = {daiGoldAuctionInfo?.priceRatio} USDS
                      </StatusValue>
                      <StatusLink href="/">View history</StatusLink>
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
                        {formatNumberWithCommas(
                          daiGoldAuctionInfo?.totalAuctionTokenAmount
                        )}{' '}
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
                        {daiGoldAuctionInfo?.totalBidTokenAmount} USDS
                      </StatusValue>
                    </>
                  )}
                </StatusContent>
              </Status>
              {isLive ? (
                <ChartContainer>
                  <ChartTitle>TGLD Price History</ChartTitle>
                  <Chart />
                </ChartContainer>
              ) : null}
              <ButtonContainer>
                <TradeButton
                  onClick={() => setModal('bidDai')}
                  style={{ whiteSpace: 'nowrap', margin: 0 }}
                >
                  BID USDS FOR TGLD
                </TradeButton>
              </ButtonContainer>
            </CurrentAuction>
          </DaiGoldAuctions>
          <AuctionsHistoryContainer>
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
        <BidDai />
      </Popover>
    </>
  );
};

const LinkIcon = styled(linkSvg)`
  fill: ${({ theme }) => theme.palette.brand};
  cursor: pointer;
`;

const PageContainer = styled.div`
  margin-top: -20px;
`;

const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 0px 40px 0px;

  ${breakpoints.phoneAndAbove(`
    gap: 60px;
    padding: 60px 0px 0px 0px;
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
  padding: 15px 0px 15px 0px;
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
    width: 100%;
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
  color: ${({ theme }) => theme.palette.brand};
  font-size: 16px;
  line-height: 19px;
  margin-left: 20px;
`;

const AuctionsHistoryContainer = styled.div``;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;
`;
