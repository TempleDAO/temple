import { Auction, GranarySubgraph, Snapshot } from './subgraph';
import {
  Announcement,
  CursorStep,
  discordTimestamp,
  EMBED_LIMITS,
  tokenLabel,
  explorerTxUrl,
} from './shared';

/**
 * Auction phase state machine.
 *
 * Phases are derived, never stored, the way the contract's `_phase()` does:
 * an early settlement or a cancellation sets `outcome`, otherwise the snapshot
 * time is compared with the auction's deadlines (see `phaseAt`). Settlement at
 * `fulfillmentEnd` leaves `outcome` as None by design. Each run compares the phase at the
 * cursor with the phase now and announces the current phase only if
 * `PHASES[previous].next` allows it. A run's announcements are ordered by
 * when each phase began, so:
 *
 * - a late run (downtime, a replay) announces only where each auction is now,
 *   not the phases it passed through, which are no longer actionable;
 * - terminal phases have no exits, so a finished auction stays silent;
 * - an unchanged or backwards move (e.g. an indexer reorg) is not an edge and
 *   is never announced;
 * - an auction first seen in this run is announced in whatever phase it is in.
 *
 *   Scheduled ─▶ Deposit ─▶ Fulfillment ─▶ Settlement  (terminal)
 *                                          Cancelled   (terminal)
 *
 * Every open phase lists all later phases and both terminals as `next`: a
 * late run skips phases, and an outcome can end the auction early.
 */
type Phase =
  'Scheduled' | 'Deposit' | 'Fulfillment' | 'Settlement' | 'Cancelled';

const PHASES: Record<
  Phase,
  {
    name: string;
    emoji: string;
    embedColor: number;
    /** Phases this one can be observed to move to between two runs. */
    next: readonly Phase[];
    /** When the auction entered this phase, if known. */
    startedAt: (auction: Auction) => bigint | undefined;
    /** Transaction recorded for entering this phase; only creation has one. */
    txHash?: (auction: Auction) => string;
  }
> = {
  Scheduled: {
    name: 'New Moon',
    emoji: '🌑',
    embedColor: 0x95a5a6,
    next: ['Deposit', 'Fulfillment', 'Settlement', 'Cancelled'],
    startedAt: (auction) => auction.createdAt,
    txHash: (auction) => auction.createdHash,
  },
  Deposit: {
    name: 'Crescent',
    emoji: '🌒',
    embedColor: 0x3498db,
    next: ['Fulfillment', 'Settlement', 'Cancelled'],
    startedAt: (auction) => auction.depositStart,
  },
  Fulfillment: {
    name: 'Gibbous',
    emoji: '🌔',
    embedColor: 0xf1c40f,
    next: ['Settlement', 'Cancelled'],
    startedAt: (auction) => auction.depositEnd,
  },
  Settlement: {
    name: 'Full Moon',
    emoji: '🌕',
    embedColor: 0x2ecc71,
    next: [],
    // Clock settlement emits no event; it happens at fulfillmentEnd.
    startedAt: (auction) => auction.settledAt || auction.fulfillmentEnd,
  },
  Cancelled: {
    name: 'Eclipse',
    emoji: '🌘',
    embedColor: 0xe74c3c,
    next: [],
    startedAt: (auction) => auction.cancelledAt || undefined,
  },
};

const isTerminal = (phase: Phase) => PHASES[phase].next.length === 0;

/**
 * Whether moving from `previous` (unseen if undefined) to `current` is
 * announced: true for a newly seen auction or any forward move, including one
 * that skipped phases between two reads (only `current` is announced, not the
 * phases skipped). False when nothing changed, the phase moved backwards
 * (e.g. a reindex), or the auction had already finished.
 */
function shouldAnnounce(previous: Phase | undefined, current: Phase) {
  return previous === undefined || PHASES[previous].next.includes(current);
}

/**
 * When the auction entered `phase`, capped at `now` so a deadline the indexer
 * has not yet passed never shows as a future time. Undefined when unknown
 * (e.g. a cancellation without its timestamp).
 */
function phaseStartedAt(auction: Auction, phase: Phase, now: number) {
  const time = PHASES[phase].startedAt(auction);
  if (time === undefined) return undefined;
  return time < BigInt(now) ? time : BigInt(now);
}

function phaseAt(auction: Auction, timestamp: number): Phase {
  if (auction.outcome === 'Settled') return 'Settlement';
  if (auction.outcome === 'Cancelled') return 'Cancelled';

  const time = BigInt(timestamp);

  if (time < auction.depositStart) return 'Scheduled';
  if (time < auction.depositEnd) return 'Deposit';
  if (time < auction.fulfillmentEnd) return 'Fulfillment';

  return 'Settlement';
}

function validateAuctionUrl(url: string) {
  const { protocol } = new URL(url);

  if (!['http:', 'https:'].includes(protocol) || /[<>\s]/.test(url))
    throw new Error('Invalid Granary auction URL');

  return url;
}

function formatAuctionUrl(template: string, auction: Auction) {
  return validateAuctionUrl(
    template
      .replaceAll('{id}', encodeURIComponent(auction.id))
      .replaceAll('{address}', auction.fixedPriceAuction.id)
      .replaceAll('{epoch}', auction.epoch.toString())
  );
}

function formatFill({ filledBids, totalDeposits }: Auction) {
  if (totalDeposits === 0n) return 'No deposits';

  const hundredths =
    (filledBids * 20000n + totalDeposits) / (2n * totalDeposits);
  return `${hundredths / 100n}.${(hundredths % 100n).toString().padStart(2, '0')}%`;
}

/** Truncates `text` to `limit` characters, marking the cut. */
function truncate(text: string, limit: number) {
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

function formatAuctionAnnouncement(
  auction: Auction,
  phase: Phase,
  startedAt: bigint | undefined,
  url: string,
  explorerUrl: string | undefined
): Announcement {
  const { bidToken: bid, fillToken: fill } = auction.pair;
  const { name, emoji, embedColor, txHash } = PHASES[phase];
  const tx = txHash && explorerTxUrl(explorerUrl, txHash(auction));

  return {
    title: truncate(
      `${tokenLabel(bid)} → ${tokenLabel(fill)} · Auction #${auction.number}`,
      EMBED_LIMITS.title
    ),
    url,
    color: embedColor,
    description: `${emoji} Entered **${name}** (${phase})`,
    fields: [
      ...(startedAt === undefined
        ? []
        : [
            {
              name: 'Phase began',
              value: discordTimestamp(startedAt),
              inline: true,
            },
          ]),
      ...(isTerminal(phase)
        ? [{ name: 'Fill', value: formatFill(auction), inline: true }]
        : []),
      ...(tx
        ? [
            {
              name: 'Transaction',
              value: `[View on explorer](${tx})`,
              inline: true,
            },
          ]
        : []),
    ],
  };
}

export async function collectAuctionAnnouncements({
  subgraph,
  factory,
  auctionUrlTemplate,
  explorerUrl,
  cursor,
}: {
  subgraph: GranarySubgraph;
  factory: string;
  auctionUrlTemplate: string;
  explorerUrl: string | undefined;
  cursor: Snapshot | undefined;
}): Promise<CursorStep<Snapshot>> {
  validateAuctionUrl(auctionUrlTemplate);

  const snapshot = await subgraph.snapshot();

  if (
    cursor &&
    (snapshot.number < cursor.number || snapshot.timestamp < cursor.timestamp)
  )
    throw new Error('Granary subgraph is behind the auction checkpoint');

  if (cursor?.number === snapshot.number) return { kind: 'unchanged' };

  // Read every page even for a baseline, so a broken query fails before the
  // cursor is first recorded.
  const auctions = await subgraph.auctions(snapshot, factory);

  if (!cursor) return { kind: 'baseline', cursor: snapshot };

  const previousAuctions = await subgraph.auctions(cursor, factory);
  const previousPhases = new Map(
    previousAuctions.map((auction) => [
      auction.id,
      phaseAt(auction, cursor.timestamp),
    ])
  );

  const announced: {
    auction: Auction;
    phase: Phase;
    startedAt: bigint | undefined;
  }[] = [];

  for (const auction of auctions) {
    const previous = previousPhases.get(auction.id);
    const phase = phaseAt(auction, snapshot.timestamp);
    if (!shouldAnnounce(previous, phase)) continue;

    announced.push({
      auction,
      phase,
      startedAt: phaseStartedAt(auction, phase, snapshot.timestamp),
    });
  }

  // Oldest phase change first, an unknown time as now; same time by auction
  // number.
  const now = BigInt(snapshot.timestamp);
  const sortTime = (entry: (typeof announced)[number]) =>
    entry.startedAt ?? now;
  announced.sort((a, b) => {
    const [ta, tb] = [sortTime(a), sortTime(b)];
    return (
      (ta < tb ? -1 : ta > tb ? 1 : 0) || a.auction.number - b.auction.number
    );
  });

  return {
    kind: 'advanced',
    cursor: snapshot,
    announcements: announced.map(({ auction, phase, startedAt }) =>
      formatAuctionAnnouncement(
        auction,
        phase,
        startedAt,
        formatAuctionUrl(auctionUrlTemplate, auction),
        explorerUrl
      )
    ),
  };
}
