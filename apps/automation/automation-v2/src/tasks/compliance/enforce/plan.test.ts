import { expect, test } from 'vitest';
import type { AuctionPhase } from '@/tasks/granary/auction-phase';
import { lcAddress } from '../shared';
import { DepositorState, PositionRead } from './plan';
import type { DepositorPosition } from './run';

// PositionRead.forPhase must fetch every Position DepositorState.from acts on
// in the read phase or any later one, or enforce never sees it.
test('the Depositor index read fetches every Position machine 4 can act on', () => {
  const gaps: string[] = [];
  for (const readPhase of PHASES)
    for (const phase of PHASES_FROM[readPhase])
      for (const position of positions(readPhase))
        for (const flagged of [true, false]) {
          const state = DepositorState.from(phase, flagged, position);
          if (state === 'Clear') continue;
          const reads = PositionRead.forPhase(readPhase);
          const fetched = READS.some(
            (r) => reads[r] && fetches(PositionRead.FILTERS[r].where, position)
          );
          if (!fetched)
            gaps.push(
              `${state} in ${phase} (read in ${readPhase}), flagged=${flagged}, ${shape(position)}`
            );
        }
  expect(gaps).toEqual([]);
});

const READS: PositionRead[] = ['deposits', 'excluded'];

const PHASES: AuctionPhase[] = [
  'Scheduled',
  'Deposit',
  'Fulfillment',
  'Settlement',
  'Cancelled',
];

/** The phases an Auction can be in by the time it's judged, given its phase when read. */
const PHASES_FROM: Record<AuctionPhase, AuctionPhase[]> = {
  Scheduled: PHASES,
  Deposit: ['Deposit', 'Fulfillment', 'Settlement', 'Cancelled'],
  Fulfillment: ['Fulfillment', 'Settlement', 'Cancelled'],
  Settlement: ['Settlement'],
  Cancelled: ['Cancelled'],
};

/** Every Position shape the subgraph can return in `readPhase`: nobody claims before Settlement. */
function positions(readPhase: AuctionPhase): DepositorPosition[] {
  const bools = [true, false];
  return bools.flatMap((hasDeposit) =>
    bools.flatMap((hasExcludedBalance) =>
      bools
        .filter((hasClaimed) => !hasClaimed || readPhase === 'Settlement')
        .map((hasClaimed) => ({
          auctionId: 'a',
          account: lcAddress('0x00000000000000000000000000000000000000aa'),
          hasDeposit,
          hasClaimed,
          hasExcludedBalance,
        }))
    )
  );
}

const shape = (p: DepositorPosition) =>
  `hasDeposit=${p.hasDeposit} hasClaimed=${p.hasClaimed} hasExcludedBalance=${p.hasExcludedBalance}`;

/**
 * Whether the subgraph returns `position` for `where`. Knows exactly the
 * operators FILTERS uses, and throws on any other, so a new filter can't
 * pass unchecked.
 */
function fetches(
  where: Record<string, string | boolean>,
  position: DepositorPosition
): boolean {
  // The Position as the subgraph holds it: amounts are decimal strings.
  const indexed: Record<string, string | boolean> = {
    totalBidAmount: position.hasDeposit ? '1' : '0',
    excludedAmount: position.hasExcludedBalance ? '1' : '0',
    hasClaimed: position.hasClaimed,
  };
  return Object.entries(where).every(([filter, value]) => {
    const gt = filter.endsWith('_gt');
    const field = gt ? filter.slice(0, -'_gt'.length) : filter;
    const actual = indexed[field];
    if (actual === undefined) throw new Error(`unknown filter: ${filter}`);
    if (gt) {
      if (typeof actual !== 'string' || typeof value !== 'string')
        throw new Error(`_gt on a non-amount: ${filter}`);
      return Number(actual) > Number(value);
    }
    if (typeof actual !== 'boolean' || typeof value !== 'boolean')
      throw new Error(`equality on a non-boolean: ${filter}`);
    return actual === value;
  });
}
