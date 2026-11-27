import type { Hex } from 'viem';
import { assertNever } from '@/tlc/assert-never';
import {
  AuctionPhase,
  auctionPhaseAt,
  AuctionPhaseInputs,
} from '@/tasks/granary/auction-phase';
import type { Finding } from '../attention';
import type { LCAddress } from '../shared';
import {
  DepositorIndexFreshness,
  DepositorState,
  SettleEarlyCheck,
} from './plan';

/**
 * An Auction this Deployment enforces, as the Depositor index sees it: its
 * phase inputs and its contract.
 */
export type EnforcedAuction = AuctionPhaseInputs & {
  /** The index's id for the Auction. Positions refer to it. */
  id: string;
  /** The FixedPriceAuction contract that `exclude` is called on. */
  address: LCAddress;
};

/** One account's Position in one Auction, as the Depositor index sees it. */
export type DepositorPosition = {
  auctionId: string;
  account: LCAddress;
  /** Its current deposit is > 0: net of withdrawals and earlier Exclusions. */
  hasDeposit: boolean;
  /** It has claimed its fill or refund. */
  hasClaimed: boolean;
  /** Its excluded balance is > 0: excluded, not yet reinstated or withdrawn. */
  hasExcludedBalance: boolean;
};

/**
 * An Auction of the same factory that points at another ComplianceCheck,
 * with compliance still enabled. Some other Deployment must enforce it.
 */
export type ElsewhereAuction = AuctionPhaseInputs & {
  address: LCAddress;
  /** The ComplianceCheck it points at now. */
  complianceCheck: LCAddress;
};

/** One Depositor index read, at one indexed block. */
export type DepositorIndexRead = {
  /** The factory's Auctions that point at this Deployment's ComplianceCheck, with compliance enabled. */
  enforced: readonly EnforcedAuction[];
  /** The factory's other Auctions with compliance enabled. No Positions are read for them. */
  elsewhere: readonly ElsewhereAuction[];
  positions: readonly DepositorPosition[];
  /** The block the index is complete up to. */
  watermark: bigint;
  /** The Watermark block's timestamp, in seconds. */
  watermarkTimestamp: bigint;
};

/**
 * Everything an enforce run touches. The task builds it from the Granary
 * subgraph, viem and Overlord; tests build it from plain data.
 */
export interface EnforceContext {
  /**
   * The head block. Read once, first: the `isFlagged` read is pinned to it,
   * and the Depositor index's freshness is measured against it.
   */
  readHeadBlock(): Promise<bigint>;
  /** Rejects when the index is unreachable, which fails the task. */
  readDepositors(): Promise<DepositorIndexRead>;
  /**
   * Of `accounts`, those `isFlagged` at `atBlock`. Called at most once per
   * run, and not at all when no account's state depends on a flag.
   */
  readFlags(
    accounts: readonly LCAddress[],
    atBlock: bigint
  ): Promise<ReadonlySet<LCAddress>>;
  /**
   * One `exclude` attempt. Resolves with the transaction hash once mined.
   * A revert before sending rejects with ExcludeReverted; anything else
   * (reverted on-chain, timed out, transport) rejects as it was thrown.
   */
  exclude(auction: EnforcedAuction, account: LCAddress): Promise<Hex>;
  nowSecs(): number;
}

export type EnforceConfig = {
  /** `DepositorIndexLagging` threshold: head − Watermark above this is `lagging`. */
  maxDepositorIndexLagBlocks: bigint;
  /**
   * ComplianceChecks some Deployment enforces on this factory's Auctions.
   * Set on one Deployment per factory (the first registered), which raises
   * AuctionComplianceCheckUnenforced for Auctions on any other; undefined on
   * the rest, so the Finding isn't raised once per owner.
   */
  enforcedComplianceChecks: ReadonlySet<LCAddress> | undefined;
};

/** How one `exclude` attempt ended (SPEC.md § Exclude attempt). */
export type ExcludeAttempt = {
  auction: LCAddress;
  account: LCAddress;
  phase: AuctionPhase;
} & (
  | { outcome: 'excluded'; txHash: Hex }
  /**
   * It reverted at gas estimation with one of `STALE_REVERTS`: the Depositor
   * index was stale (the account was already excluded or withdrew, or the
   * window closed), so there is nothing to do.
   */
  | { outcome: 'skipped'; error: string }
  | { outcome: 'failed'; error: string }
);

/** Something a human only needs to know about: the Bot excluded an account. */
export interface EnforceNotice {
  kind: 'Excluded';
  auction: LCAddress;
  account: LCAddress;
  phase: AuctionPhase;
  txHash: Hex;
}

export type EnforceRun = {
  attempts: ExcludeAttempt[];
  /** One per Auction in Fulfillment, made before this run's attempts. */
  settleEarly: SettleEarlyCheck[];
  findings: Finding[];
  notices: EnforceNotice[];
};

export const ExcludeAttempt = {
  /**
   * Reverts that mean the Depositor index was stale: the chain already
   * disagrees. An `exclude` that reverts with one of them at gas estimation
   * is skipped. `AccountNotFlagged` isn't one: this run read the account
   * Flagged at head.
   */
  STALE_REVERTS: new Set([
    'ExpectedNonZero',
    'InvalidPhase',
  ]) as ReadonlySet<string>,
};

/**
 * `exclude` reverted before it was sent (at gas estimation, so it cost no
 * gas), with the Auction's error decoded.
 */
export class ExcludeReverted extends Error {
  constructor(
    /** The Auction's error name, or the raw revert data if it isn't one. */
    readonly revert: string
  ) {
    super(`exclude reverted: ${revert}`);
    this.name = 'ExcludeReverted';
  }
}

/**
 * One enforce run for a Deployment: excludes every Flagged Depositor of
 * every Auction in its Exclusion window, whoever set the flag. Keeps no
 * record of its attempts: a dropped exclusion is retried by the next run.
 * Add-only: it never reinstates.
 */
export async function runEnforce(
  context: EnforceContext,
  config: EnforceConfig
): Promise<EnforceRun> {
  const head = await context.readHeadBlock();
  const index = await context.readDepositors();
  const nowSecs = context.nowSecs();
  const auctions = new Map(
    index.enforced.map((a) => [
      a.id,
      { auction: a, phase: auctionPhaseAt(a, nowSecs) },
    ])
  );
  const positions = index.positions.flatMap((position) => {
    const at = auctions.get(position.auctionId);
    return at ? [{ ...at, position }] : [];
  });

  const accounts = [
    ...new Set(
      positions
        .filter((p) => DepositorState.dependsOnFlag(p.phase, p.position))
        .map((p) => p.position.account)
    ),
  ];
  const flagged = accounts.length
    ? await context.readFlags(accounts, head)
    : new Set<LCAddress>();

  const findings: Finding[] = [];
  // Lag only delays an exclusion; the run proceeds.
  const freshness = DepositorIndexFreshness.from(
    index.watermark,
    head,
    config.maxDepositorIndexLagBlocks
  );
  switch (freshness) {
    case 'lagging':
      findings.push({
        kind: 'DepositorIndexLagging',
        key: '',
        summary: `Depositor index Watermark ${index.watermark}, head ${head} (${head - index.watermark} blocks behind)`,
      });
      break;
    case 'withinLag':
      break;
    default:
      return assertNever(freshness);
  }

  const enforced = config.enforcedComplianceChecks;
  if (enforced)
    for (const a of index.elsewhere)
      if (
        !enforced.has(a.complianceCheck) &&
        beforeWindowCloses(auctionPhaseAt(a, nowSecs))
      )
        findings.push({
          kind: 'AuctionComplianceCheckUnenforced',
          key: a.address,
          summary: `Auction ${a.address} points at ComplianceCheck ${a.complianceCheck}, which no Deployment enforces. Its Flagged Depositors won't be excluded. Its Exclusion window closes at fulfillmentEnd ${isoAt(a.fulfillmentEnd)}.`,
        });

  const toExclude: typeof positions = [];
  for (const p of positions) {
    const state = DepositorState.from(
      p.phase,
      flagged.has(p.position.account),
      p.position
    );
    const key = pairKey(p.auction.address, p.position.account);
    switch (state) {
      case 'ToExclude':
        toExclude.push(p);
        break;
      case 'ReinstateAvailable':
        findings.push({
          kind: 'ReinstateAvailable',
          key,
          summary: `${p.position.account} is excluded from Auction ${p.auction.address} and no longer Flagged. It can be reinstated until Deposit ends at ${isoAt(p.auction.depositEnd)}.`,
        });
        break;
      case 'MissedExclusion':
        findings.push({
          kind: 'MissedExclusion',
          key,
          summary: `${p.position.account} is Flagged and was filled without being excluded from Auction ${p.auction.address}, which has settled. Its claim stays frozen while it is Flagged.`,
        });
        break;
      case 'Clear':
        break;
      default:
        return assertNever(state);
    }
  }

  const settleEarly = [...auctions.values()]
    .filter(({ phase }) => phase === 'Fulfillment')
    .map(({ auction }) =>
      SettleEarlyCheck.from(
        auction,
        head,
        index.watermarkTimestamp,
        toExclude
          .filter((p) => p.auction.id === auction.id)
          .map((p) => p.position.account)
      )
    );

  const attempts: ExcludeAttempt[] = [];
  const notices: EnforceNotice[] = [];
  for (const { auction, phase, position } of toExclude) {
    const attempt = await attemptExclude(
      context,
      auction,
      phase,
      position.account
    );
    attempts.push(attempt);
    switch (attempt.outcome) {
      case 'excluded':
        notices.push({
          kind: 'Excluded',
          auction: attempt.auction,
          account: attempt.account,
          phase: attempt.phase,
          txHash: attempt.txHash,
        });
        break;
      case 'skipped':
        break;
      case 'failed':
        findings.push(excludeFailed(attempt, auction));
        break;
      default:
        return assertNever(attempt);
    }
  }

  return { attempts, settleEarly, findings, notices };
}

/** One `exclude`, caught on its own so a failure never stops the run. */
async function attemptExclude(
  context: EnforceContext,
  auction: EnforcedAuction,
  phase: AuctionPhase,
  account: LCAddress
): Promise<ExcludeAttempt> {
  const pair = { auction: auction.address, account, phase };
  try {
    const txHash = await context.exclude(auction, account);
    return { ...pair, outcome: 'excluded', txHash };
  } catch (e) {
    if (e instanceof ExcludeReverted)
      return {
        ...pair,
        outcome: ExcludeAttempt.STALE_REVERTS.has(e.revert)
          ? 'skipped'
          : 'failed',
        error: e.revert,
      };
    return { ...pair, outcome: 'failed', error: String(e).split('\n')[0] };
  }
}

/** The ExclusionFailed Finding for a failed attempt, keyed by (Auction, account). */
function excludeFailed(
  attempt: ExcludeAttempt & { outcome: 'failed' },
  auction: EnforcedAuction
): Finding {
  return {
    kind: 'ExclusionFailed',
    key: pairKey(attempt.auction, attempt.account),
    summary:
      `exclude ${attempt.account} on Auction ${attempt.auction} failed: ${attempt.error}. ` +
      `The Auction is in ${attempt.phase}; its Exclusion window closes at fulfillmentEnd ${isoAt(auction.fulfillmentEnd)}.` +
      lastChance(attempt.phase),
  };
}

function lastChance(phase: AuctionPhase): string {
  switch (phase) {
    case 'Fulfillment':
      return " Last chance: after fulfillmentEnd or a settleEarly the exclusion can't be made.";
    case 'Deposit':
    case 'Scheduled':
    case 'Settlement':
    case 'Cancelled':
      return '';
    default:
      return assertNever(phase);
  }
}

/** Whether an Exclusion is still possible: the window is open or yet to open. */
function beforeWindowCloses(phase: AuctionPhase): boolean {
  switch (phase) {
    case 'Scheduled':
    case 'Deposit':
    case 'Fulfillment':
      return true;
    case 'Settlement':
    case 'Cancelled':
      return false;
    default:
      return assertNever(phase);
  }
}

/** The Finding key of an (Auction, account) pair. */
const pairKey = (auction: LCAddress, account: LCAddress) =>
  `${auction}:${account}`;

/** A unix-seconds timestamp, as ISO 8601. */
const isoAt = (secs: bigint) => new Date(Number(secs) * 1000).toISOString();
