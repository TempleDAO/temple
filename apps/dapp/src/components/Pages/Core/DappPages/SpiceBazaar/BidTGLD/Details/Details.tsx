import active from 'assets/icons/active.svg?react';
import scheduled from 'assets/icons/scheduled.svg?react';
import styled from 'styled-components';
import { useState } from 'react';
import { Button } from 'components/Button/Button';
import { Chart } from '../Chart/Chart';
import { BidTGLD, BidTGLDMode } from '../BidTGLD';
import { Popover } from 'components/Pages/Core/DappPages/SpiceBazaar/components/Popover';
import { AuctionsHistory } from './Table';
import * as breakpoints from 'styles/breakpoints';
import { Link } from 'react-router-dom';
import arrowBack from 'assets/icons/arrow_back.svg?react';

export const Details = () => {
  const [isLive, setIsLive] = useState(true);
  const [modal, setModal] = useState<'closed' | 'bidTgld'>('closed');

  return (
    <>
      <PageContainer>
        <ContentContainer>
          <SpiceAuction>
            <BackLink to="/dapp/spice/bid">
              <ArrowBack />
              Back to all Spice Auctions
            </BackLink>
            <SpiceAuctionDetails>
              <SpiceAuctionTitle>Spice Auction Details</SpiceAuctionTitle>
              <CurrentAuction>
                <Header>
                  <HeaderLeft>
                    <Left>
                      <CurrentAuctionTitle>Current Auction</CurrentAuctionTitle>
                      <CurrentAddress>0xC4973de5e...5EcF</CurrentAddress>
                    </Left>
                    <Right>
                      <Epoch>
                        <Text>EPOCH 2</Text>
                      </Epoch>
                      <AuctionId>
                        <Text>AUCTION ID</Text>
                      </AuctionId>
                    </Right>
                  </HeaderLeft>
                  <HeaderRight>
                    <HeaderRightContainer
                      onClick={() => {
                        setIsLive(!isLive);
                      }}
                      style={{ whiteSpace: 'nowrap', margin: 0 }}
                    >
                      {isLive ? (
                        <>
                          <AuctionStatus>
                            <Active />
                            ACTIVE
                          </AuctionStatus>
                          <TimeStamp>
                            Ends in 00:15:03:04 at 07.07.24 23:59 CST
                          </TimeStamp>
                        </>
                      ) : (
                        <>
                          <AuctionStatus>
                            <Scheduled />
                            SCHEDULE
                          </AuctionStatus>
                          <TimeStamp>05.10.24 at 00:00 CST</TimeStamp>
                        </>
                      )}
                    </HeaderRightContainer>
                  </HeaderRight>
                </Header>
                <ButtonContainer>
                  <TradeButton
                    onClick={() => setModal('bidTgld')}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    BID TGLD
                  </TradeButton>
                </ButtonContainer>
                <Status>
                  <StatusContent>
                    <StatusTitle>Price Ratio</StatusTitle>
                    <StatusValue>1 TOKEN = 5.32 TGLD</StatusValue>
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
                  </StatusContent>
                  <StatusContent>
                    <StatusTitle>Amount to be auctioned</StatusTitle>
                    <StatusValue>2500 TOKENS</StatusValue>
                  </StatusContent>
                  <StatusContent>
                    <StatusTitle>Amount Submitted</StatusTitle>
                    <StatusValue>2500 TGLD</StatusValue>
                  </StatusContent>
                </Status>
                {isLive ? (
                  <ChartContainer>
                    <ChartTitle>Token Price History</ChartTitle>
                    <Chart />
                  </ChartContainer>
                ) : null}
              </CurrentAuction>
            </SpiceAuctionDetails>
          </SpiceAuction>
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
        <BidTGLD mode={BidTGLDMode.Bid} />
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
  padding: 20px 20px 40px 20px;

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

const HeaderRightContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.palette.black};
  border: solid 1px #588f22;
  border-radius: 10px;
  padding: 16px 24px 16px 24px;
  gap: 10px;
  width: 305px;

  ${breakpoints.phoneAndAbove(`
    padding: 8px 24px 8px 24px;
    width: 490px;
    flex-direction: row;
    height: 45px;
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
  white-space: normal;
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
`;

const Epoch = styled.div`
  display: flex;
  width: 75px;
  align-items: center;
  padding: 8px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  background: ${({ theme }) => theme.palette.black};
`;

const AuctionId = styled.div`
  display: flex;
  width: 90px;
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
`;

const AuctionsHistoryContainer = styled.div``;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;

  ${breakpoints.phoneAndAbove(`
    justify-content: left;
  `)}
`;

export const TradeButton = styled(Button)`
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
`;
