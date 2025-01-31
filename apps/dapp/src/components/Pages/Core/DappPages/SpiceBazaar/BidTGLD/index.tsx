import styled from 'styled-components';
import active from 'assets/icons/active.svg?react';
import scheduled from 'assets/icons/scheduled.svg?react';
import { BidTopNav } from './TopNav';
import { AuctionsHistory } from './Table/Table';
import * as breakpoints from 'styles/breakpoints';

export const Bid = () => {
  return (
    <PageContainer>
      <BidTopNav />
      <ContentContainer>
        <SpiceAuctions>
          <SpiceTitle>
            <SpiceTitleText>Spice Auctions</SpiceTitleText>
          </SpiceTitle>
          <Status>
            <StatusContent>
              <StatusHeader>
                <AuctionName>
                  <AuctionNameText>Spice 2</AuctionNameText>
                </AuctionName>
                <Epoch>
                  <EpochText>Epoch 2</EpochText>
                </Epoch>
              </StatusHeader>
              <StatusBody>
                <AmountInAuction>
                  <AmountInAuctionIcon>
                    <img src="" alt="Token icon" />
                  </AmountInAuctionIcon>
                  <AmountInActionSum>70.530 KAMI</AmountInActionSum>
                </AmountInAuction>
                <TotalAmountText>
                  Total amount currently in auction
                </TotalAmountText>
                <AuctionStatus>
                  <LiveContainer>
                    <ActiveContainer>
                      <Active />
                      ACTIVE
                    </ActiveContainer>
                    <AuctionTimeStamp> 00:15:03:04</AuctionTimeStamp>
                  </LiveContainer>
                </AuctionStatus>
              </StatusBody>
            </StatusContent>
            <StatusContent>
              <StatusHeader>
                <AuctionName>
                  <AuctionNameText>Spice 5</AuctionNameText>
                </AuctionName>
                <Epoch>
                  <EpochText>Epoch 3</EpochText>
                </Epoch>
              </StatusHeader>
              <StatusBody>
                <AmountInAuction>
                  <AmountInAuctionIcon>
                    <img src="" alt="Token icon" />
                  </AmountInAuctionIcon>
                  <AmountInActionSum>85.000 ENA</AmountInActionSum>
                </AmountInAuction>
                <TotalAmountText>
                  Total amount currently in auction
                </TotalAmountText>
                <AuctionStatus>
                  <LiveContainer>
                    <ActiveContainer>
                      <Active />
                      ACTIVE
                    </ActiveContainer>
                    <AuctionTimeStamp> 00:15:03:04</AuctionTimeStamp>
                  </LiveContainer>
                </AuctionStatus>
              </StatusBody>
            </StatusContent>
            <StatusContent>
              <StatusHeader>
                <AuctionName>
                  <AuctionNameText>Spice 2</AuctionNameText>
                </AuctionName>
                <Epoch>
                  <EpochText>Epoch 2</EpochText>
                </Epoch>
              </StatusHeader>
              <StatusBody>
                <AmountInAuction>
                  <AmountInAuctionIcon>
                    <img src="" alt="Token icon" />
                  </AmountInAuctionIcon>
                  <AmountInActionSum>40.320 KAMI</AmountInActionSum>
                </AmountInAuction>
                <TotalAmountText>Total amount to be auctioned</TotalAmountText>
                <AuctionStatus>
                  <ScheduledContainer>
                    <Scheduled />
                    UPCOMING AUCTION
                  </ScheduledContainer>
                </AuctionStatus>
              </StatusBody>
            </StatusContent>
          </Status>
        </SpiceAuctions>
        <AuctionsHistoryContainer>
          <AuctionsHistory />
        </AuctionsHistoryContainer>
      </ContentContainer>
    </PageContainer>
  );
};

const PageContainer = styled.div`
  margin-top: -20px;
`;

const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 60px;
  margin-top: 20px;

  ${breakpoints.phoneAndAbove(`
    margin-top: 40px;
  `)}
`;

const SpiceAuctions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const SpiceTitle = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 15px;
`;

const SpiceTitleText = styled.h2`
  font-size: 28px;
  line-height: 52px;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0px;

  ${breakpoints.phoneAndAbove(`
    font-size: 36px;
    line-height: 67px;
  `)}
`;

const Status = styled.div`
  display: flex;
  gap: 20px;
  flex-direction: column;

  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
  `)}
`;

const StatusContent = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 12px 20px 20px 20px;
  gap: 20px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  background: ${({ theme }) => theme.palette.gradients.grey};
`;

const StatusHeader = styled.div`
  display: flex;
  width: 100%;
  flex-direction: row;
  justify-content: flex-end;
  gap: 8px;
`;
const AuctionName = styled.div`
  padding: 8px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  background: ${({ theme }) => theme.palette.black};
`;

const AuctionNameText = styled.p`
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  color: ${({ theme }) => theme.palette.brand};
  margin: 0px;
`;

const Epoch = styled.div`
  display: flex;
  align-items: center;
  padding: 8px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  background: ${({ theme }) => theme.palette.black};
`;

const EpochText = styled.p`
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  color: ${({ theme }) => theme.palette.brand};
  margin: 0px;
`;

const StatusBody = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`;

const AmountInAuction = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`;

const AmountInAuctionIcon = styled.div`
  display: flex;
  width: 42px;
  height: 42px;
`;

const AmountInActionSum = styled.h3`
  font-size: 24px;
  line-height: 44px;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0px;
`;

const TotalAmountText = styled.p`
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
  white-space: nowrap;
  color: ${({ theme }) => theme.palette.brand};
  margin: 0px;
`;

const AuctionStatus = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 43px;
  padding: 8px;
  gap: 8px;
  border-radius: 10px;
  background: ${({ theme }) => theme.palette.black};
`;

const Active = styled(active)``;

const Scheduled = styled(scheduled)``;

const LiveContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
`;

const ActiveContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  line-height: 15px;
  text-align: left;
  color: #588f22;
`;

const ScheduledContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 13px;
  font-weight: 700;
  line-height: 15px;
  gap: 8px;
`;

const AuctionTimeStamp = styled.div`
  font-size: 13px;
  font-weight: 700;
  line-height: 15px;
  color: #588f22;
`;

const AuctionsHistoryContainer = styled.div``;
