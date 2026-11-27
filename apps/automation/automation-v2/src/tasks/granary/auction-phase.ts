import { assertNever } from '@/tlc/assert-never';
import type { Auction } from './subgraph';

/**
 * An Auction's phase, as the contract's `phase()` derives it. Shared by the
 * Granary notifications and compliance enforce so the two never disagree.
 *
 *   Scheduled ─▶ Deposit ─▶ Fulfillment ─▶ Settlement  (terminal)
 *                                          Cancelled   (terminal)
 *
 * Cancelled can follow any phase before Settlement.
 */
export type AuctionPhase =
  'Scheduled' | 'Deposit' | 'Fulfillment' | 'Settlement' | 'Cancelled';

/** What the phase is derived from: the indexed outcome and the deadlines. */
export type AuctionPhaseInputs = Pick<
  Auction,
  'outcome' | 'depositStart' | 'depositEnd' | 'fulfillmentEnd'
>;

/**
 * The Auction's phase at `timestamp` (seconds). Derived, never stored: an
 * early settlement (`settleEarly`) or a cancellation sets `outcome`;
 * otherwise `timestamp` is compared with the deadlines. Settlement at
 * `fulfillmentEnd` runs no transaction, so `outcome` stays `None` and the
 * deadline decides.
 */
export function auctionPhaseAt(
  auction: AuctionPhaseInputs,
  timestamp: number
): AuctionPhase {
  switch (auction.outcome) {
    case 'Settled':
      return 'Settlement';
    case 'Cancelled':
      return 'Cancelled';
    case 'None': {
      const time = BigInt(timestamp);
      if (time < auction.depositStart) return 'Scheduled';
      if (time < auction.depositEnd) return 'Deposit';
      if (time < auction.fulfillmentEnd) return 'Fulfillment';
      return 'Settlement';
    }
    default:
      return assertNever(auction.outcome);
  }
}
