import { useSpiceAuctionCountdown } from 'hooks/spicebazaar/use-spice-auction-countdown';
import { SpiceAuctionInfo } from 'providers/SpiceAuctionProvider';
import styled from 'styled-components';

const AuctionTimeStamp = styled.div`
  font-size: 13px;
  font-weight: 700;
  line-height: 15px;
  color: #588f22;
  margin: 0px;
`;

const ScheduledText = styled.p`
  font-size: 13px;
  font-weight: 700;
  line-height: 15px;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0px;
`;

interface AuctionCountdownProps {
  auction: SpiceAuctionInfo;
  isLive: boolean;
}

export const AuctionCountdown = ({
  auction,
  isLive,
}: AuctionCountdownProps) => {
  const countdown = useSpiceAuctionCountdown(auction);
  return isLive ? (
    <AuctionTimeStamp>Ends in {countdown}</AuctionTimeStamp>
  ) : (
    <ScheduledText>Starts in {countdown}</ScheduledText>
  );
};
