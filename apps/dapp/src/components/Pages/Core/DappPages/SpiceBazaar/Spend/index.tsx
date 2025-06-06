import styled from 'styled-components';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import active from 'assets/icons/active.svg?react';
import scheduled from 'assets/icons/scheduled.svg?react';
import * as breakpoints from 'styles/breakpoints';
import ena from 'assets/icons/ena_logo.svg?react';
import kami from 'assets/icons/kami_logo.svg?react';
import ori from 'assets/icons/ori_logo.svg?react';
import ired from 'assets/icons/ired_logo.svg?react';
import { Popover } from 'components/Pages/Core/DappPages/SpiceBazaar/components/Popover';
import { Button } from 'components/Button/Button';
import {
  BidTGLD,
  BidTGLDMode,
} from 'components/Pages/Core/DappPages/SpiceBazaar/Spend/BidTGLD';
import { BridgeTGLD } from 'components/Pages/Core/DappPages/SpiceBazaar/Spend/BridgeTGLD';
import { useSpiceAuction } from 'providers/SpiceAuctionProvider';
import Loader from 'components/Loader/Loader';
import { AuctionCountdown } from './AuctionCountdown';
import { SpiceAuctionInfo } from 'providers/SpiceAuctionProvider';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from 'providers/WalletProvider';
import { getAppConfig } from 'constants/newenv';

// Custom hook for auction-specific user metrics
export const useAuctionUserMetrics = (auctionAddress: string | undefined) => {
  const { currentUser, allSpiceAuctions } = useSpiceAuction();
  const { fetch } = currentUser;
  const { data: allAuctions } = allSpiceAuctions;

  return useQuery({
    queryKey: ['auctionUserMetrics', auctionAddress] as const,
    queryFn: async () => {
      const auction = allAuctions?.find(
        (a: SpiceAuctionInfo) => a.address === auctionAddress
      );
      if (!auction) return { currentEpochBidAmount: 0 };
      return fetch(auction.staticConfig);
    },
    enabled: !!auctionAddress,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
};

// Individual auction component to handle metrics
const AuctionCard = ({
  auction,
  onOpenBidModal,
}: {
  auction: SpiceAuctionInfo;
  onOpenBidModal: (auction: SpiceAuctionInfo, mode: BidTGLDMode) => void;
}) => {
  const navigate = useNavigate();

  const { data: userMetrics, isLoading: userMetricsLoading } =
    useAuctionUserMetrics(auction.address);

  const getLogo = (name?: string) => {
    if (!name) return <KamiLogo />;

    const nameLower = name.toLowerCase();
    if (nameLower.includes('kami')) return <KamiLogo />;
    if (nameLower.includes('ena')) return <EnaLogo />;
    if (nameLower.includes('ori')) return <OriLogo />;
    if (nameLower.includes('ired')) return <IredLogo />;
    return <KamiLogo />;
  };

  return (
    <StatusContent key={auction.address}>
      <StatusHeader>
        <Epoch>
          <Text>EPOCH {auction.currentEpoch}</Text>
        </Epoch>
      </StatusHeader>
      <StatusBody>
        <AmountInAuction>
          {getLogo(auction.auctionTokenSymbol)}
          <AmountInActionSum>
            {auction.totalAuctionTokenAmount} {auction.auctionTokenSymbol}
          </AmountInActionSum>
        </AmountInAuction>
        <TotalAmountText>
          {auction.currentEpochAuctionLive
            ? 'Total amount currently in auction'
            : 'Total amount scheduled for bidding'}
        </TotalAmountText>
        <AuctionStatus>
          {auction.currentEpochAuctionLive ? (
            <ActiveContainer>
              <Active />
              <ActiveText>Active</ActiveText>
              <AuctionCountdown auction={auction} isLive={true} />
            </ActiveContainer>
          ) : (
            <ScheduledContainer>
              <Scheduled />
              <AuctionCountdown auction={auction} isLive={false} />
            </ScheduledContainer>
          )}
        </AuctionStatus>
      </StatusBody>
      <ButtonsContainer>
        <TradeButton
          onClick={() => navigate(`details/${auction.address}`)}
          style={{ whiteSpace: 'nowrap', margin: 0 }}
        >
          Details
        </TradeButton>
        {auction.currentEpochAuctionLive &&
          (userMetricsLoading ? (
            <Loader iconSize={32} />
          ) : userMetrics?.currentEpochBidAmount ? (
            <TradeButton
              onClick={() => onOpenBidModal(auction, BidTGLDMode.IncreaseBid)}
              style={{ whiteSpace: 'nowrap', margin: 0 }}
              gradient={true}
            >
              INCREASE BID
            </TradeButton>
          ) : (
            <TradeButton
              onClick={() => onOpenBidModal(auction, BidTGLDMode.Bid)}
              style={{ whiteSpace: 'nowrap', margin: 0 }}
              gradient={true}
            >
              BID NOW
            </TradeButton>
          ))}
      </ButtonsContainer>
    </StatusContent>
  );
};

export const Spend = () => {
  const { allSpiceAuctions } = useSpiceAuction();
  const {
    data: allAuctions,
    loading: allAuctionsLoading,
    fetch,
  } = allSpiceAuctions;

  const { updateBalance } = useWallet();

  const [modal, setModal] = useState<{
    type: 'closed' | 'bidTgld' | 'bridgeTgld';
    auction?: SpiceAuctionInfo;
    currentBidAmount?: string;
  }>({ type: 'closed' });
  const [modalMode, setModalMode] = useState<BidTGLDMode>(BidTGLDMode.Bid);

  // Get user metrics for the selected auction
  const {
    data: userMetrics,
    isLoading: userMetricsLoading,
    refetch: refetchUserMetrics,
  } = useAuctionUserMetrics(modal.auction?.address);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // on load, load balances
  useEffect(() => {
    updateBalance().catch((err) => {
      console.warn('Failed to update balance:', err);
      // Optionally show a user-friendly message
    });
  }, [updateBalance]);

  const handleOpenBidModal = async (
    auction: SpiceAuctionInfo,
    mode: BidTGLDMode
  ) => {
    // Set the modal first so the hook can use the auction address
    setModal({
      type: 'bidTgld',
      auction,
      currentBidAmount: '0', // We'll update this after fetching
    });
    setModalMode(mode);

    // Then fetch the latest metrics
    const { data: metrics } = await refetchUserMetrics();

    // Update the modal with the fetched metrics
    setModal((prev) => ({
      ...prev,
      currentBidAmount: metrics?.currentEpochBidAmount?.toString() || '0',
    }));
  };

  const activeAuctions = useMemo(
    () => allAuctions?.filter((auction) => auction.staticConfig.isActive),
    [allAuctions]
  );

  return (
    <>
      <PageContainer>
        <ContentContainer>
          <SpiceTitle>
            <SpiceTitleText>Spice Auctions</SpiceTitleText>
            <Bridge>
              <BridgeText>
                Bridge your Temple Gold to{' '}
                {getAppConfig().spiceBazaar.tgldBridge.altchainDisplayName} to
                use them in Spice Auctions.
              </BridgeText>
              <TradeButton
                onClick={() => setModal({ type: 'bridgeTgld' })}
                style={{ whiteSpace: 'nowrap', margin: 0 }}
              >
                BRIDGE&nbsp;MY&nbsp;<SpanBreak>TEMPLE&nbsp;GOLD</SpanBreak>
              </TradeButton>
            </Bridge>
          </SpiceTitle>
          <SpiceAuctions>
            {allAuctionsLoading && <Loader />}
            {!allAuctionsLoading &&
            activeAuctions &&
            activeAuctions.length > 0 ? (
              <Status>
                {activeAuctions.map((auction) => (
                  <AuctionCard
                    key={auction.address}
                    auction={auction}
                    onOpenBidModal={handleOpenBidModal}
                  />
                ))}
              </Status>
            ) : (
              !allAuctionsLoading &&
              activeAuctions &&
              activeAuctions.length === 0 && (
                <NoAuctions>No active auctions found</NoAuctions>
              )
            )}
          </SpiceAuctions>
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
            auction={modal.auction}
            currentBidAmount={modal.currentBidAmount}
            onBidSuccess={async () => {
              // Refetch metrics after bid success signalled by the provider
              await refetchUserMetrics();
              // Close modal after metrics are updated
              setModal({ type: 'closed' });
            }}
            isLoadingUserMetrics={userMetricsLoading}
          />
        )}
        {modal.type === 'bridgeTgld' && (
          <BridgeTGLD
            onBridgeComplete={() => {
              setModal({ type: 'closed' });
            }}
          />
        )}
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
  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
`)}
`;

const SpiceTitleText = styled.h2`
  font-size: 28px;
  line-height: 52px;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0px;

  ${breakpoints.phoneAndAbove(`
    font-size: 36px;
    line-height: 67px;
    flex-grow: 1;
  `)}
`;

const Bridge = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  background: ${({ theme }) => theme.palette.brandDarker};
  border-radius: 10px;
  padding: 10px 28px;
  gap: 10px;

  ${breakpoints.phoneAndAbove(`
     width: 495px;
  `)}
`;

const BridgeText = styled.div`
  font-weight: 400;
  font-size: 12px;
  line-height: 150%;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const SpanBreak = styled.span`
  display: block;
  white-space: normal;

  ${breakpoints.phoneAndAbove(`
    display: inline;
    white-space: nowrap;
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

const NoAuctions = styled.div`
  text-align: center;
  padding: 40px;
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 18px;
  background: ${({ theme }) => theme.palette.gradients.grey};
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.palette.brand};
`;
