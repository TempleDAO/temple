import type { AuctionPhase } from '@/tasks/granary/auction-phase';
import { assertNever } from '@/tlc/assert-never';
import type { LCAddress } from '../shared';
import type { DepositorPosition } from './run';

/** Machine 4: what one (Auction, account) needs. */
export type DepositorState =
  'ToExclude' | 'ReinstateAvailable' | 'MissedExclusion' | 'Clear';

/**
 * The two Position reads of the Depositor index:
 *
 * - `deposits`: unclaimed Positions with a current deposit > 0 (To exclude
 *   in the window, Missed exclusion once settled);
 * - `excluded`: Positions with an excluded balance > 0 (Reinstate available).
 */
export type PositionRead = 'deposits' | 'excluded';

/**
 * How fresh a Depositor index read is:
 *
 * - lagging: head − Watermark > the lag threshold;
 * - withinLag: otherwise.
 */
export type DepositorIndexFreshness = 'lagging' | 'withinLag';

export const DepositorState = {
  /**
   * Machine 4, the Depositor table. The only code that decides what an
   * (Auction, account) needs. `PositionRead.forPhase` must fetch every
   * Position it can act on; plan.test.ts checks that.
   */
  from(
    phase: AuctionPhase,
    flagged: boolean,
    position: DepositorPosition
  ): DepositorState {
    switch (phase) {
      case 'Deposit':
        if (flagged && position.hasDeposit) return 'ToExclude';
        return !flagged && position.hasExcludedBalance
          ? 'ReinstateAvailable'
          : 'Clear';
      case 'Fulfillment':
        return flagged && position.hasDeposit ? 'ToExclude' : 'Clear';
      case 'Settlement':
        return flagged && position.hasDeposit && !position.hasClaimed
          ? 'MissedExclusion'
          : 'Clear';
      case 'Scheduled':
      case 'Cancelled':
        return 'Clear';
      default:
        return assertNever(phase);
    }
  },

  /**
   * Whether a Position's state depends on `isFlagged`: the candidates for
   * the one multicall. Derived from the table, so the two never disagree.
   */
  dependsOnFlag(phase: AuctionPhase, position: DepositorPosition): boolean {
    return (
      DepositorState.from(phase, true, position) !==
      DepositorState.from(phase, false, position)
    );
  },
};

export const PositionRead = {
  /** Each read as the subgraph's `Position_filter`. */
  FILTERS: {
    deposits: { where: { totalBidAmount_gt: '0', hasClaimed: false } },
    excluded: { where: { excludedAmount_gt: '0' } },
  } satisfies Record<PositionRead, { where: Record<string, string | boolean> }>,

  /**
   * Which Positions to read for an Auction in `phase` at read time: a
   * superset of what `DepositorState.from` acts on in that phase or any
   * later one, since runEnforce's clock is a little later.
   */
  forPhase(phase: AuctionPhase): Record<PositionRead, boolean> {
    switch (phase) {
      case 'Scheduled':
      case 'Deposit':
        return { deposits: true, excluded: true };
      case 'Fulfillment':
      case 'Settlement':
        return { deposits: true, excluded: false };
      case 'Cancelled':
        return { deposits: false, excluded: false };
      default:
        return assertNever(phase);
    }
  },
};

export const DepositorIndexFreshness = {
  /** The Depositor index's freshness, from its Watermark and the head block. */
  from(
    watermark: bigint,
    headBlock: bigint,
    maxLagBlocks: bigint
  ): DepositorIndexFreshness {
    return headBlock - watermark > maxLagBlocks ? 'lagging' : 'withinLag';
  },
};

/**
 * Whether the Admin can `settleEarly` an Auction in Fulfillment without
 * missing an exclusion, as of `atBlock`: no `blockers`. Two hold it back:
 *
 * - `depositorIndexBeforeDepositEnd`: the Depositor index's Watermark is
 *   older than `depositEnd`, so a deposit may not be indexed yet. Once it
 *   isn't, the Depositor list is final: nobody deposits after `depositEnd`.
 * - `flaggedDepositors`: Depositors Flagged at `atBlock` that still have a
 *   deposit. A failed exclusion stays here; a successful one leaves once
 *   the index sees it.
 *
 * Flags are read at head, so a check at `atBlock` sees every flag up to it.
 * It is only logged: settleEarly is rare, and the Admin reads the latest
 * run's line (README.md § Before settleEarly).
 */
export type SettleEarlyCheck = {
  auction: LCAddress;
  atBlock: bigint;
  blockers: SettleEarlyBlocker[];
};

export type SettleEarlyBlocker =
  | {
      kind: 'depositorIndexBeforeDepositEnd';
      watermarkTimestamp: bigint;
      depositEnd: bigint;
    }
  | { kind: 'flaggedDepositors'; accounts: LCAddress[] };

export const SettleEarlyCheck = {
  from(
    auction: { address: LCAddress; depositEnd: bigint },
    atBlock: bigint,
    watermarkTimestamp: bigint,
    flaggedDepositors: readonly LCAddress[]
  ): SettleEarlyCheck {
    const blockers: SettleEarlyBlocker[] = [];
    // A deposit lands only while block time < depositEnd (auctionPhaseAt).
    if (watermarkTimestamp < auction.depositEnd)
      blockers.push({
        kind: 'depositorIndexBeforeDepositEnd',
        watermarkTimestamp,
        depositEnd: auction.depositEnd,
      });
    if (flaggedDepositors.length)
      blockers.push({
        kind: 'flaggedDepositors',
        accounts: [...flaggedDepositors].sort(),
      });
    return { auction: auction.address, atBlock, blockers };
  },
};
