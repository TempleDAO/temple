import { SpiceAuctionInfo } from 'providers/SpiceAuctionProvider';

export enum AuctionState {
  NOT_SCHEDULED = 'NOT_SCHEDULED',
  SCHEDULED = 'SCHEDULED',
  LIVE = 'LIVE',
  ENDED = 'ENDED',
}

export function getAuctionState(
  auction: SpiceAuctionInfo | null
): AuctionState {
  if (!auction) {
    return AuctionState.NOT_SCHEDULED;
  }

  const now = Date.now();

  // If the auction is currently live
  if (auction.currentEpochAuctionLive) {
    return AuctionState.LIVE;
  }

  // If auction start time is in the future, it's scheduled
  if (auction.auctionStartTime > now) {
    return AuctionState.SCHEDULED;
  }

  // If auction end time has passed and epoch > 0, it has ended
  if (auction.auctionEndTime < now && auction.currentEpoch > 0) {
    return AuctionState.ENDED;
  }

  // If epoch is 0 and no auction start time configured, not scheduled
  if (auction.currentEpoch === 0 && !auction.auctionStartTime) {
    return AuctionState.NOT_SCHEDULED;
  }

  // Default to not scheduled
  return AuctionState.NOT_SCHEDULED;
}
