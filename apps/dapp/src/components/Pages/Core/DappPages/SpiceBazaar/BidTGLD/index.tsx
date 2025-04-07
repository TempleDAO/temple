import styled from 'styled-components';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import active from 'assets/icons/active.svg?react';
import scheduled from 'assets/icons/scheduled.svg?react';
import { AuctionsHistory } from './Table/Table';
import * as breakpoints from 'styles/breakpoints';
import ena from 'assets/icons/ena_logo.svg?react';
import kami from 'assets/icons/kami_logo.svg?react';
import ori from 'assets/icons/ori_logo.svg?react';
import ired from 'assets/icons/ired_logo.svg?react';
import { Popover } from 'components/Pages/Core/DappPages/SpiceBazaar/components/Popover';
import { UpcomingAuctionsPopover } from './components/Popover';
import { Button } from 'components/Button/Button';
import {
  BidTGLD,
  BidTGLDMode,
} from 'components/Pages/Core/DappPages/SpiceBazaar/BidTGLD/BidTGLD';

export const Bid = () => {
  const auctionData = [
    {
      id: 'auction1',
      epoch: 'EPOCH 2',
      logo: <KamiLogo />,
      amount: '70.530 KAMI',
      status: 'ACTIVE',
      time: '00:15:03:04',
      type: 'active',
      popoverData: [
        { date: '11 Apr 2025', amount: '2.6M TGLD' },
        { date: '11 May 2025', amount: '1.2M TGLD' },
        { date: '11 Jun 2025', amount: 'TBD' },
      ],
    },
    // {
    //   id: "auction2",
    //   epoch: "Epoch 2",
    //   logo: <EnaLogo />,
    //   amount: "85.000 ENA",
    //   status: "ACTIVE",
    //   time: "00:15:03:04",
    //   type: "active",
    // },
    // {
    //   id: "auction3",
    //   epoch: "Epoch 3",
    //   logo: <OriLogo />,
    //   amount: "40.320 ORI",
    //   status: "UPCOMING",
    //   time: "00:12:01:03",
    //   type: "upcoming",
    //   popoverData: [
    //     { date: "11 Apr 2025", amount: "2.6M TGLD" },
    //     { date: "11 May 2025", amount: "1.2M TGLD" },
    //     { date: "11 Jun 2025", amount: "TBD" },
    //   ],
    // },
    // {
    //   id: "auction4",
    //   epoch: "Epoch 3",
    //   logo: <IredLogo />,
    //   amount: "40.320 IRED",
    //   status: "UPCOMING",
    //   time: "TBD",
    //   type: "upcoming",
    //   popoverData: [
    //     { date: "11 Apr 2025", amount: "2.6M TGLD" },
    //     { date: "11 May 2025", amount: "1.2M TGLD" },
    //     { date: "11 Jun 2025", amount: "TBD" },
    //   ],
    // },
  ];

  const navigate = useNavigate();

  // const [selected, setSelected] = useState<"MAINNET" | "BERACHAIN">("MAINNET");
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  const [modal, setModal] = useState<'closed' | 'bidTgld'>('closed');

  const handleOpenPopover = (auctionId: string) => {
    setOpenPopoverId((prev) => (prev === auctionId ? null : auctionId));
  };

  return (
    <>
      <PageContainer>
        <ContentContainer>
          <SpiceTitle>
            <SpiceTitleText>Spice Auctions</SpiceTitleText>
            {/* <ToggleContainer>
              <ToggleWrapper>
                <Slider position={selected} />
                <ToggleButton active={selected === "MAINNET"} onClick={() => setSelected("MAINNET")}>
                  MAINNET
                </ToggleButton>
                <ToggleButton active={selected === "BERACHAIN"} onClick={() => setSelected("BERACHAIN")}>
                  BERACHAIN
                </ToggleButton>
              </ToggleWrapper>
            </ToggleContainer> */}
          </SpiceTitle>
          <SpiceAuctions>
            <Status>
              {auctionData.map((auction) => (
                <StatusContent key={auction.id}>
                  <StatusHeader>
                    <KekId>
                      <Text>KEK ID</Text>
                    </KekId>
                    <Epoch>
                      <Text>{auction.epoch}</Text>
                    </Epoch>
                    <AuctionId>
                      <Text>AUCTION ID</Text>
                    </AuctionId>
                  </StatusHeader>
                  <StatusBody>
                    <AmountInAuction>
                      {auction.logo}
                      <AmountInActionSum>{auction.amount}</AmountInActionSum>
                    </AmountInAuction>
                    <TotalAmountText>
                      {auction.type === 'active'
                        ? 'Total amount currently in auction'
                        : 'Total amount scheduled for bidding'}
                    </TotalAmountText>
                    <AuctionStatus>
                      {auction.type === 'active' ? (
                        <ActiveContainer>
                          <Active />
                          <ActiveText>{auction.status} </ActiveText>
                          <AuctionTimeStamp>{auction.time}</AuctionTimeStamp>
                        </ActiveContainer>
                      ) : (
                        <ScheduledContainer>
                          <Scheduled />
                          <ScheduledText>
                            {auction.status} Starts in {auction.time}
                          </ScheduledText>
                        </ScheduledContainer>
                      )}

                      {auction.popoverData ? (
                        <MoreAuctionsText
                          onClick={() => handleOpenPopover(auction.id)}
                        >
                          More upcoming auctions
                          <UpcomingAuctionsPopover
                            isOpen={openPopoverId === auction.id}
                            onClose={() => setOpenPopoverId(null)}
                            data={auction.popoverData}
                            titles={['Date', 'Amount']}
                            width="240px"
                          />
                        </MoreAuctionsText>
                      ) : (
                        <MoreAuctionsText>Upcoming auctions</MoreAuctionsText>
                      )}
                    </AuctionStatus>
                  </StatusBody>
                  <ButtonsContainer>
                    <TradeButton
                      onClick={() => navigate('details')}
                      style={{ whiteSpace: 'nowrap', margin: 0 }}
                    >
                      Details
                    </TradeButton>
                    {auction.type === 'active' && (
                      <TradeButton
                        onClick={() => setModal('bidTgld')}
                        style={{ whiteSpace: 'nowrap', margin: 0 }}
                        gradient={true}
                      >
                        BID NOW
                      </TradeButton>
                    )}
                  </ButtonsContainer>
                </StatusContent>
              ))}
            </Status>
          </SpiceAuctions>
          {/* <AuctionsHistoryContainer>
            <AuctionsHistory />
          </AuctionsHistoryContainer> */}
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
  margin-bottom: 220px;

  ${breakpoints.phoneAndAbove(`
    margin-bottom: 80px;
`)}
`;

const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 40px;
  margin-top: 20px;

  ${breakpoints.phoneAndAbove(`
    margin-top: 40px;
    gap: 60px;
  `)}
`;

const SpiceAuctions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const SpiceTitle = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
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

const ToggleContainer = styled.div`
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  border: 1.5px solid ${({ theme }) => theme.palette.brand};
  border-radius: 30px;
`;

const ToggleWrapper = styled.div`
  position: relative;
  border-radius: 30px;
  display: flex;
  overflow: hidden;
  width: 100%;
`;

const ToggleButton = styled.button<{ active: boolean }>`
  position: relative;
  width: 50%;
  z-index: 10;
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 12px;
  line-height: 18px;
  font-weight: 700;
  padding: 8px 0px;
  background: none;
  border: ${({ active, theme }) =>
    active ? `1.5px solid ${theme.palette.brand}` : 'none'};
  border-radius: 40px;
  outline: none;
  cursor: pointer;
`;

const Slider = styled.div<{ position: 'MAINNET' | 'BERACHAIN' }>`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 50%;
  background: ${({ theme }) => theme.palette.gradients.dark};
  border-radius: 40px;
  transform: ${({ position }) =>
    position === 'BERACHAIN' ? 'translateX(100%)' : 'translateX(0)'};
`;

const Status = styled.div`
  display: flex;
  gap: 20px;
  flex-direction: column;

  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-between;
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

  ${breakpoints.phoneAndAbove(`
    flex: 1 1 calc(33.33% - 14px);
    // max-width: calc(33.33% - 14px);
    max-width: 314px;
  `)}
`;

const StatusHeader = styled.div`
  display: flex;
  width: 100%;
  flex-direction: row;
  justify-content: flex-end;
  gap: 8px;
`;

const KekId = styled.div`
  padding: 8px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.palette.brand};
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
  align-items: center;
  padding: 8px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.palette.brand};
`;

const AuctionId = styled.div`
  display: flex;
  align-items: center;
  padding: 8px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.palette.brand};
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

const KamiLogo = styled(kami)`
  width: 42px;
  height: 42px;
`;

const EnaLogo = styled(ena)`
  width: 42px;
  height: 42px;
`;

const OriLogo = styled(ori)`
  width: 42px;
  height: 42px;
`;

const IredLogo = styled(ired)`
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
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 76px;
  padding: 10px 8px;
  gap: 8px;
  border-radius: 10px;
  background: ${({ theme }) => theme.palette.black};
  position: relative;
`;

const Active = styled(active)``;

const Scheduled = styled(scheduled)``;

const ActiveContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
`;

const AuctionTimeStamp = styled.div`
  font-size: 13px;
  font-weight: 700;
  line-height: 15px;
  color: #588f22;
  margin: 0px;
`;

const ActiveText = styled.p`
  font-size: 13px;
  font-weight: 700;
  line-height: 15px;
  color: #588f22;
  margin: 0px;
`;

const ScheduledContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
`;

const ScheduledText = styled.p`
  font-size: 13px;
  font-weight: 700;
  line-height: 15px;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0px;
`;

const MoreAuctionsText = styled.p`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.palette.brand};
  text-decoration: underline;
  cursor: pointer;
  position: relative;
  margin: 0px;
`;

const AuctionsHistoryContainer = styled.div``;

const ButtonsContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 10px;
  width: 100%;
`;

const TradeButton = styled(Button)<{ gradient?: boolean }>`
  padding: 10px 20px;
  width: auto;
  height: min-content;
  background: ${({ theme, gradient }) =>
    gradient
      ? 'linear-gradient(90deg, #58321A 20%, #95613F 84.5%)'
      : theme.palette.gradients.dark};
  border: ${({ theme }) => `1px solid ${theme.palette.brandDark}`};
  box-shadow: '0px 0px 20px 0px rgba(222, 92, 6, 0.4)'};
  border-radius: 10px;
  font-weight: 700;
  font-size: 12px;
  line-height: 20px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.palette.brandLight};
`;
