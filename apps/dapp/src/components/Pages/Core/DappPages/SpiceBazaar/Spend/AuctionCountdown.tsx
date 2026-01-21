import { useSpiceAuctionCountdown } from 'hooks/spicebazaar/use-spice-auction-countdown';
import { SpiceAuctionInfo } from 'providers/SpiceAuctionProvider';
import styled from 'styled-components';
import { AuctionState } from 'utils/spice-auction-state';

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

const EndedText = styled.p`
  font-size: 13px;
  font-weight: 700;
  line-height: 15px;
  color: ${({ theme }) => theme.palette.brand};
  margin: 0px;
`;

interface AuctionCountdownProps {
  auction: SpiceAuctionInfo;
}

const formatEndDate = (date: Date | null): string => {
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export const AuctionCountdown = ({ auction }: AuctionCountdownProps) => {
  const { countdown, state, endDate } = useSpiceAuctionCountdown(auction);

  switch (state) {
    case AuctionState.LIVE:
      return <AuctionTimeStamp>Ends in {countdown}</AuctionTimeStamp>;
    case AuctionState.SCHEDULED:
      return <ScheduledText>Starts in {countdown}</ScheduledText>;
    case AuctionState.ENDED:
      return <EndedText>on {formatEndDate(endDate)}</EndedText>;
    case AuctionState.NOT_SCHEDULED:
    default:
      return <ScheduledText>Starts in TBD</ScheduledText>;
  }
};
