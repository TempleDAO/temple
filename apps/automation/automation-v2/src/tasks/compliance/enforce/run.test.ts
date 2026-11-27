import { describe, expect, test } from 'vitest';
import type { Hex } from 'viem';
import { LCAddress, lcAddress } from '../shared';
import {
  DepositorPosition,
  ElsewhereAuction,
  EnforceConfig,
  EnforceContext,
  EnforcedAuction,
  ExcludeReverted,
  runEnforce,
} from './run';

const ALICE = lcAddress('0x00000000000000000000000000000000000000a1');
const BOB = lcAddress('0x00000000000000000000000000000000000000b0');

const NOW = 1_000_000;
const HOUR = 3600n;
const T = BigInt(NOW);

/** The default chain below sits exactly at this threshold: head 100, Watermark 90. */
const config: EnforceConfig = {
  maxDepositorIndexLagBlocks: 10n,
  enforcedComplianceChecks: undefined,
};

/** An Auction whose deadlines put it in `phase` at NOW. */
function auction(
  n: number,
  phase: 'Scheduled' | 'Deposit' | 'Fulfillment' | 'Settlement' | 'Cancelled'
): EnforcedAuction {
  const address = lcAddress(`0x${n.toString(16).padStart(40, '0')}`);
  const deadlines = {
    Scheduled: [T + HOUR, T + 2n * HOUR, T + 3n * HOUR],
    Deposit: [T - HOUR, T + HOUR, T + 2n * HOUR],
    Fulfillment: [T - 2n * HOUR, T - HOUR, T + HOUR],
    Settlement: [T - 3n * HOUR, T - 2n * HOUR, T - HOUR],
    Cancelled: [T - HOUR, T + HOUR, T + 2n * HOUR],
  }[phase];
  return {
    id: `${address}-1`,
    address,
    depositStart: deadlines[0],
    depositEnd: deadlines[1],
    fulfillmentEnd: deadlines[2],
    outcome: phase === 'Cancelled' ? 'Cancelled' : 'None',
  };
}

const deposit = (
  a: EnforcedAuction,
  account: LCAddress
): DepositorPosition => ({
  auctionId: a.id,
  account,
  hasDeposit: true,
  hasClaimed: false,
  hasExcludedBalance: false,
});

/** An account excluded earlier, with no deposit since. */
const excluded = (
  a: EnforcedAuction,
  account: LCAddress
): DepositorPosition => ({
  ...deposit(a, account),
  hasDeposit: false,
  hasExcludedBalance: true,
});

type Sent = { auction: LCAddress; account: LCAddress };

/**
 * A fake chain as data: the head block, the Depositor index read, the
 * accounts Flagged at head, and an `exclude` that records each call and
 * resolves with a hash, or rejects with the error `rejects` gives for the
 * account.
 */
function chain(opts: {
  auctions: EnforcedAuction[];
  elsewhere?: ElsewhereAuction[];
  positions: DepositorPosition[];
  flagged: LCAddress[];
  rejects?: Partial<Record<LCAddress, unknown>>;
  watermark?: bigint;
  watermarkTimestamp?: bigint;
  head?: bigint;
}) {
  const sent: Sent[] = [];
  const head = opts.head ?? 100n;
  const context: EnforceContext = {
    readHeadBlock: async () => head,
    readDepositors: async () => ({
      enforced: opts.auctions,
      elsewhere: opts.elsewhere ?? [],
      positions: opts.positions,
      watermark: opts.watermark ?? 90n,
      watermarkTimestamp: opts.watermarkTimestamp ?? T,
    }),
    readFlags: async (accounts, atBlock) => {
      if (atBlock !== head) throw new Error(`read at ${atBlock}, not the head`);
      return new Set(accounts.filter((a) => opts.flagged.includes(a)));
    },
    exclude: async (a, account) => {
      sent.push({ auction: a.address, account });
      if (opts.rejects && account in opts.rejects) throw opts.rejects[account];
      return `0x${sent.length.toString(16).padStart(64, '0')}` as Hex;
    },
    nowSecs: () => NOW,
  };
  return { context, sent };
}

test('excludes a Flagged Depositor of an Auction in Deposit, with a Notice', async () => {
  const a = auction(1, 'Deposit');
  const { context, sent } = chain({
    auctions: [a],
    positions: [deposit(a, ALICE), deposit(a, BOB)],
    flagged: [ALICE],
  });

  const result = await runEnforce(context, config);

  expect(sent).toEqual([{ auction: a.address, account: ALICE }]);
  expect(result.attempts).toEqual([
    {
      auction: a.address,
      account: ALICE,
      phase: 'Deposit',
      outcome: 'excluded',
      txHash: `0x${'1'.padStart(64, '0')}`,
    },
  ]);
  expect(result.notices).toEqual([
    {
      kind: 'Excluded',
      auction: a.address,
      account: ALICE,
      phase: 'Deposit',
      txHash: `0x${'1'.padStart(64, '0')}`,
    },
  ]);
  expect(result.findings).toEqual([]);
});

test('excludes only in the Exclusion window: Deposit and Fulfillment', async () => {
  const auctions = (
    ['Scheduled', 'Deposit', 'Fulfillment', 'Settlement', 'Cancelled'] as const
  ).map((phase, i) => auction(i + 1, phase));
  const { context, sent } = chain({
    auctions,
    positions: auctions.map((a) => deposit(a, ALICE)),
    flagged: [ALICE],
  });

  const result = await runEnforce(context, config);

  expect(result.attempts.map((a) => [a.auction, a.phase, a.outcome])).toEqual([
    [auctions[1].address, 'Deposit', 'excluded'],
    [auctions[2].address, 'Fulfillment', 'excluded'],
  ]);
  expect(sent.map((s) => s.auction)).toEqual([
    auctions[1].address,
    auctions[2].address,
  ]);
  expect(result.notices).toHaveLength(2);
});

test('an Auction settled early or cancelled is out of the window whatever its deadlines', async () => {
  const settled = { ...auction(1, 'Deposit'), outcome: 'Settled' as const };
  const cancelled = auction(2, 'Cancelled');
  const { context, sent } = chain({
    auctions: [settled, cancelled],
    positions: [deposit(settled, ALICE), deposit(cancelled, ALICE)],
    flagged: [ALICE],
  });

  const result = await runEnforce(context, config);

  expect(sent).toEqual([]);
  expect(result.attempts).toEqual([]);
  // Past its window: the settled one is a Missed exclusion, the cancelled one is Clear.
  expect(result.findings.map((f) => [f.kind, f.key])).toEqual([
    ['MissedExclusion', `${settled.address}:${ALICE}`],
  ]);
});

test('an unflagged Depositor is left alone', async () => {
  const a = auction(1, 'Fulfillment');
  const { context, sent } = chain({
    auctions: [a],
    positions: [deposit(a, ALICE), deposit(a, BOB)],
    flagged: [],
  });

  expect((await runEnforce(context, config)).attempts).toEqual([]);
  expect(sent).toEqual([]);
});

test('an account with no current deposit is not excluded, even after an earlier Exclusion', async () => {
  const a = auction(1, 'Deposit');
  const { context, sent } = chain({
    auctions: [a],
    positions: [excluded(a, ALICE)],
    flagged: [ALICE],
  });

  await runEnforce(context, config);

  expect(sent).toEqual([]);
});

test.each(['Deposit', 'Fulfillment'] as const)(
  'an account excluded, unflagged, re-deposited and flagged again is excluded again in %s',
  async (phase) => {
    const a = auction(1, phase);
    const { context, sent } = chain({
      auctions: [a],
      // Alice still holds the excluded balance from the earlier Exclusion.
      positions: [{ ...deposit(a, ALICE), hasExcludedBalance: true }],
      flagged: [ALICE],
    });

    const result = await runEnforce(context, config);

    expect(sent).toEqual([{ auction: a.address, account: ALICE }]);
    expect(
      result.attempts.map((x) => [x.auction, x.account, x.outcome])
    ).toEqual([[a.address, ALICE, 'excluded']]);
    expect(result.findings).toEqual([]);
  }
);

test('one attempt rejecting does not stop the others', async () => {
  const a = auction(1, 'Deposit');
  const b = auction(2, 'Fulfillment');
  const { context, sent } = chain({
    auctions: [a, b],
    positions: [deposit(a, ALICE), deposit(a, BOB), deposit(b, BOB)],
    flagged: [ALICE, BOB],
    rejects: { [ALICE]: new Error('execution reverted') },
  });

  const result = await runEnforce(context, config);

  expect(sent).toHaveLength(3);
  expect(result.attempts.map((x) => [x.auction, x.account, x.outcome])).toEqual(
    [
      [a.address, ALICE, 'failed'],
      [a.address, BOB, 'excluded'],
      [b.address, BOB, 'excluded'],
    ]
  );
  expect(result.notices).toHaveLength(2);
});

test('reads isFlagged once per run, for the accounts whose state depends on it', async () => {
  const CAROL = lcAddress('0x00000000000000000000000000000000000000c0');
  const DAVE = lcAddress('0x00000000000000000000000000000000000000d0');
  const EVE = lcAddress('0x00000000000000000000000000000000000000e0');
  const deposit_ = auction(1, 'Deposit');
  const fulfillment = auction(2, 'Fulfillment');
  const settled = auction(3, 'Settlement');
  const cancelled = auction(4, 'Cancelled');
  const { context } = chain({
    auctions: [deposit_, fulfillment, settled, cancelled],
    positions: [
      deposit(deposit_, ALICE),
      excluded(deposit_, BOB),
      excluded(fulfillment, EVE),
      deposit(settled, CAROL),
      { ...deposit(settled, DAVE), hasClaimed: true },
      deposit(cancelled, EVE),
    ],
    flagged: [ALICE, CAROL, DAVE, EVE],
  });
  let flagReads = 0;
  const result = await runEnforce(
    {
      ...context,
      readFlags: async (accounts, atBlock) => {
        flagReads++;
        return context.readFlags(accounts, atBlock);
      },
    },
    config
  );

  expect(flagReads).toBe(1);
  expect(result.attempts.map((a) => [a.auction, a.account, a.outcome])).toEqual(
    [[deposit_.address, ALICE, 'excluded']]
  );
  expect(result.findings.map((f) => [f.kind, f.key])).toEqual([
    ['ReinstateAvailable', `${deposit_.address}:${BOB}`],
    ['MissedExclusion', `${settled.address}:${CAROL}`],
  ]);
});

test('no isFlagged read when no account needs a flag check', async () => {
  const a = auction(1, 'Cancelled');
  const { context } = chain({
    auctions: [a],
    positions: [deposit(a, ALICE)],
    flagged: [ALICE],
  });
  let flagReads = 0;
  const result = await runEnforce(
    {
      ...context,
      readFlags: async (accounts, atBlock) => {
        flagReads++;
        return context.readFlags(accounts, atBlock);
      },
    },
    config
  );

  expect(flagReads).toBe(0);
  expect(result).toEqual({
    attempts: [],
    settleEarly: [],
    findings: [],
    notices: [],
  });
});

describe('settleEarly check, for each Auction in Fulfillment', () => {
  const ful = auction(1, 'Fulfillment'); // depositEnd T − 1h
  const dep = auction(2, 'Deposit');

  test('safe once the index is past depositEnd and no Depositor with a deposit is Flagged', async () => {
    const { context } = chain({
      auctions: [ful, dep],
      positions: [deposit(ful, BOB), deposit(dep, ALICE)],
      // ALICE is Flagged in the Deposit Auction only: not this one's blocker.
      flagged: [ALICE],
      head: 100n,
    });
    expect((await runEnforce(context, config)).settleEarly).toEqual([
      { auction: ful.address, atBlock: 100n, watermark: 90n, blockers: [] },
    ]);
  });

  test('not safe while the index is before depositEnd: a deposit may be missing', async () => {
    const { context } = chain({
      auctions: [ful],
      positions: [],
      flagged: [],
      watermarkTimestamp: ful.depositEnd - 1n,
    });
    expect((await runEnforce(context, config)).settleEarly).toEqual([
      {
        auction: ful.address,
        atBlock: 100n,
        watermark: 90n,
        blockers: [
          {
            kind: 'depositorIndexBeforeDepositEnd',
            watermarkTimestamp: ful.depositEnd - 1n,
            depositEnd: ful.depositEnd,
          },
        ],
      },
    ]);
  });

  test('not safe while a Flagged Depositor still has a deposit, even if this run excludes it or fails to', async () => {
    const { context } = chain({
      auctions: [ful],
      positions: [deposit(ful, ALICE), deposit(ful, BOB)],
      flagged: [ALICE, BOB],
      rejects: { [BOB]: new ExcludeReverted('InvalidAccess') },
      watermarkTimestamp: ful.depositEnd,
    });
    const run = await runEnforce(context, config);
    expect(run.attempts.map((a) => a.outcome)).toEqual(['excluded', 'failed']);
    expect(run.settleEarly).toEqual([
      {
        auction: ful.address,
        atBlock: 100n,
        watermark: 90n,
        blockers: [{ kind: 'flaggedDepositors', accounts: [ALICE, BOB] }],
      },
    ]);
  });
});

test('a Flagged Depositor filled unexcluded in a settled Auction is a Missed exclusion', async () => {
  const a = auction(1, 'Settlement');
  const { context, sent } = chain({
    auctions: [a],
    positions: [deposit(a, ALICE), deposit(a, BOB)],
    flagged: [ALICE],
  });

  const result = await runEnforce(context, config);

  expect(sent).toEqual([]);
  expect(result.findings).toEqual([
    {
      kind: 'MissedExclusion',
      key: `${a.address}:${ALICE}`,
      summary: expect.stringContaining(ALICE),
    },
  ]);
  expect(result.notices).toEqual([]);
});

test('an excluded account no longer Flagged in Deposit raises ReinstateAvailable, and the Bot only reports it', async () => {
  const a = auction(1, 'Deposit');
  const { context, sent } = chain({
    auctions: [a],
    positions: [
      excluded(a, ALICE),
      { ...deposit(a, BOB), hasExcludedBalance: true },
    ],
    flagged: [],
  });

  const result = await runEnforce(context, config);

  // The context offers no reinstate, and no exclude is sent either.
  expect(sent).toEqual([]);
  expect(result.attempts).toEqual([]);
  expect(result.notices).toEqual([]);
  expect(result.findings).toEqual([
    {
      kind: 'ReinstateAvailable',
      key: `${a.address}:${ALICE}`,
      summary: expect.stringContaining(ALICE),
    },
    {
      kind: 'ReinstateAvailable',
      key: `${a.address}:${BOB}`,
      summary: expect.stringContaining(BOB),
    },
  ]);
});

// A Finding resolves when a completed run no longer reports it.
test.each([
  {
    case: 'ReinstateAvailable, once the account is reinstated',
    phase: 'Deposit',
    position: { hasDeposit: true, hasExcludedBalance: false },
    flagged: false,
  },
  {
    case: 'ReinstateAvailable, once the account withdraws its excluded balance',
    phase: 'Deposit',
    position: { hasDeposit: false, hasExcludedBalance: false },
    flagged: false,
  },
  {
    case: 'ReinstateAvailable, once the account is flagged again',
    phase: 'Deposit',
    position: { hasDeposit: false, hasExcludedBalance: true },
    flagged: true,
  },
  {
    case: 'ReinstateAvailable, once Deposit ends',
    phase: 'Fulfillment',
    position: { hasDeposit: false, hasExcludedBalance: true },
    flagged: false,
  },
  {
    case: 'MissedExclusion, once the account is unflagged',
    phase: 'Settlement',
    position: { hasDeposit: true },
    flagged: false,
  },
  {
    case: 'MissedExclusion, once the account claims',
    phase: 'Settlement',
    position: { hasDeposit: true, hasClaimed: true },
    flagged: true,
  },
] as const)('resolves $case', async ({ phase, position, flagged }) => {
  const a = auction(1, phase);
  const { context, sent } = chain({
    auctions: [a],
    positions: [{ ...deposit(a, ALICE), ...position }],
    flagged: flagged ? [ALICE] : [],
  });

  const result = await runEnforce(context, config);

  expect(result.findings).toEqual([]);
  expect(sent).toEqual([]);
});

test('a Cancelled Auction is never a Missed exclusion or Reinstate available', async () => {
  const a = auction(1, 'Cancelled');
  const { context, sent } = chain({
    auctions: [a],
    positions: [
      deposit(a, ALICE),
      { ...deposit(a, BOB), hasDeposit: false, hasExcludedBalance: true },
    ],
    flagged: [ALICE],
  });

  expect(await runEnforce(context, config)).toMatchObject({
    attempts: [],
    findings: [],
    notices: [],
  });
  expect(sent).toEqual([]);
});

test('DepositorIndexLagging once head − Watermark passes the threshold, not at it', async () => {
  const a = auction(1, 'Deposit');
  const run = (head: bigint) =>
    runEnforce(
      chain({
        auctions: [a],
        positions: [deposit(a, ALICE)],
        flagged: [],
        watermark: 90n,
        head,
      }).context,
      config
    );

  expect((await run(100n)).findings).toEqual([]);
  expect((await run(101n)).findings).toEqual([
    {
      kind: 'DepositorIndexLagging',
      key: '',
      summary: 'Depositor index Watermark 90, head 101 (11 blocks behind)',
    },
  ]);
});

test('at fulfillmentEnd exactly the window is closed: a Missed exclusion, no attempt', async () => {
  const a: EnforcedAuction = {
    ...auction(1, 'Fulfillment'),
    depositStart: T - 2n * HOUR,
    depositEnd: T - HOUR,
    fulfillmentEnd: T,
    outcome: 'None',
  };
  const { context, sent } = chain({
    auctions: [a],
    positions: [deposit(a, ALICE)],
    flagged: [ALICE],
  });

  const result = await runEnforce(context, config);

  expect(sent).toEqual([]);
  expect(result.attempts).toEqual([]);
  expect(result.findings.map((f) => [f.kind, f.key])).toEqual([
    ['MissedExclusion', `${a.address}:${ALICE}`],
  ]);
});

describe('When the Depositor index lags (Watermark 50, head 100)', () => {
  const lagging = { watermark: 50n, head: 100n };
  const LAGGING = {
    kind: 'DepositorIndexLagging',
    key: '',
    summary: 'Depositor index Watermark 50, head 100 (50 blocks behind)',
  };

  test('the run carries on: a Flagged Depositor is still excluded', async () => {
    const a = auction(1, 'Fulfillment');
    const { context, sent } = chain({
      auctions: [a],
      positions: [deposit(a, ALICE)],
      flagged: [ALICE],
      ...lagging,
    });

    const result = await runEnforce(context, config);

    expect(sent).toEqual([{ auction: a.address, account: ALICE }]);
    expect(result.notices.map((n) => n.account)).toEqual([ALICE]);
    expect(result.findings).toEqual([LAGGING]);
  });

  // Stale reads: the contract rejects each at gas estimation, the attempt
  // is skipped silently, and the other Depositors are still excluded.
  test.each([
    ['withdraws everything after the Watermark', 'Deposit', 'ExpectedNonZero'],
    ['is excluded after the Watermark', 'Fulfillment', 'ExpectedNonZero'],
    [
      'is in an Auction settled early after the Watermark',
      'Fulfillment',
      'InvalidPhase',
    ],
    [
      'is in an Auction cancelled after the Watermark',
      'Deposit',
      'InvalidPhase',
    ],
  ] as const)(
    'a Depositor who %s is tried and skipped, never wrongly excluded',
    async (_, phase, revert) => {
      const a = auction(1, phase);
      const b = auction(2, 'Deposit');
      const { context, sent } = chain({
        auctions: [a, b],
        positions: [deposit(a, ALICE), deposit(b, BOB)],
        flagged: [ALICE, BOB],
        rejects: { [ALICE]: new ExcludeReverted(revert) },
        ...lagging,
      });

      const result = await runEnforce(context, config);

      expect(sent).toEqual([
        { auction: a.address, account: ALICE },
        { auction: b.address, account: BOB },
      ]);
      expect(result.attempts[0]).toMatchObject({
        account: ALICE,
        outcome: 'skipped',
        error: revert,
      });
      expect(result.notices.map((n) => [n.auction, n.account])).toEqual([
        [b.address, BOB],
      ]);
      expect(result.findings).toEqual([LAGGING]);
    }
  );

  test('an account that claims after the Watermark is no longer Flagged, so nothing applies', async () => {
    const a = auction(1, 'Settlement');
    const { context, sent } = chain({
      auctions: [a],
      positions: [deposit(a, ALICE)],
      flagged: [],
      ...lagging,
    });

    const result = await runEnforce(context, config);

    expect(sent).toEqual([]);
    expect(result.findings).toEqual([LAGGING]);
  });

  test('fulfillmentEnd passing after the Watermark closes the window: the phase uses the clock', async () => {
    const a = auction(1, 'Settlement');
    const { context, sent } = chain({
      auctions: [a],
      positions: [deposit(a, ALICE)],
      flagged: [ALICE],
      ...lagging,
    });

    const result = await runEnforce(context, config);

    expect(sent).toEqual([]);
    expect(result.attempts).toEqual([]);
    expect(result.findings.map((f) => [f.kind, f.key])).toEqual([
      [LAGGING.kind, LAGGING.key],
      ['MissedExclusion', `${a.address}:${ALICE}`],
    ]);
  });
});

test('an unreachable Depositor index fails the run before the isFlagged read or any attempt', async () => {
  const a = auction(1, 'Deposit');
  const { context, sent } = chain({
    auctions: [a],
    positions: [deposit(a, ALICE)],
    flagged: [ALICE],
  });
  let flagReads = 0;
  const unreachable = new Error('Granary subgraph unreachable');

  await expect(
    runEnforce(
      {
        ...context,
        readDepositors: async () => {
          throw unreachable;
        },
        readFlags: async (accounts, atBlock) => {
          flagReads++;
          return context.readFlags(accounts, atBlock);
        },
      },
      config
    )
  ).rejects.toBe(unreachable);
  expect(flagReads).toBe(0);
  expect(sent).toEqual([]);
});

describe('attempt outcomes', () => {
  /** One Flagged Depositor of `a` whose exclude rejects with `error`. */
  const rejecting = (a: EnforcedAuction, error: unknown) =>
    chain({
      auctions: [a],
      positions: [deposit(a, ALICE)],
      flagged: [ALICE],
      rejects: { [ALICE]: error },
    }).context;

  test.each([
    ['InvalidAccess', new ExcludeReverted('InvalidAccess'), 'InvalidAccess'],
    ['an unknown revert', new ExcludeReverted('0xdeadbeef'), '0xdeadbeef'],
    [
      'a revert on-chain',
      new Error('transaction-reverted'),
      'Error: transaction-reverted',
    ],
    [
      'a timeout',
      new Error('transaction-timed-out'),
      'Error: transaction-timed-out',
    ],
  ])('%s fails with ExclusionFailed', async (_, error, named) => {
    const a = auction(1, 'Deposit');

    const result = await runEnforce(rejecting(a, error), config);

    expect(result.attempts).toEqual([
      {
        auction: a.address,
        account: ALICE,
        phase: 'Deposit',
        outcome: 'failed',
        error: named,
      },
    ]);
    expect(result.findings).toEqual([
      {
        kind: 'ExclusionFailed',
        key: `${a.address}:${ALICE}`,
        summary: `exclude ${ALICE} on Auction ${a.address} failed: ${named}. The Auction is in Deposit; its Exclusion window closes at fulfillmentEnd ${new Date(Number(a.fulfillmentEnd) * 1000).toISOString()}.`,
      },
    ]);
    expect(result.notices).toEqual([]);
  });

  test('AccountNotFlagged after this run read the account Flagged fails, and a later run that reads it unflagged resolves it', async () => {
    const a = auction(1, 'Deposit');

    const first = await runEnforce(
      rejecting(a, new ExcludeReverted('AccountNotFlagged')),
      config
    );

    expect(first.attempts).toMatchObject([
      { account: ALICE, outcome: 'failed', error: 'AccountNotFlagged' },
    ]);
    expect(first.findings.map((f) => [f.kind, f.key])).toEqual([
      ['ExclusionFailed', `${a.address}:${ALICE}`],
    ]);

    const { context, sent } = chain({
      auctions: [a],
      positions: [deposit(a, ALICE)],
      flagged: [],
    });
    const next = await runEnforce(context, config);

    expect(sent).toEqual([]);
    expect(next.findings).toEqual([]);
  });

  test('in Fulfillment ExclusionFailed is marked as the last chance', async () => {
    const a = auction(1, 'Fulfillment');

    const result = await runEnforce(
      rejecting(a, new ExcludeReverted('InvalidAccess')),
      config
    );

    expect(result.findings.map((f) => f.summary)).toEqual([
      `exclude ${ALICE} on Auction ${a.address} failed: InvalidAccess. The Auction is in Fulfillment; its Exclusion window closes at fulfillmentEnd ${new Date(Number(a.fulfillmentEnd) * 1000).toISOString()}. Last chance: after fulfillmentEnd or a settleEarly the exclusion can't be made.`,
    ]);
  });
});

/** An Auction of the same factory on another ComplianceCheck, in `phase` at NOW. */
const onComplianceCheck = (
  n: number,
  phase: Parameters<typeof auction>[1],
  complianceCheck: LCAddress
): ElsewhereAuction => {
  const { address, depositStart, depositEnd, fulfillmentEnd, outcome } =
    auction(n, phase);
  return {
    address,
    complianceCheck,
    depositStart,
    depositEnd,
    fulfillmentEnd,
    outcome,
  };
};

const OWN = lcAddress('0x00000000000000000000000000000000000000c1');
const ENFORCED = lcAddress('0x00000000000000000000000000000000000000c2');
const UNENFORCED = lcAddress('0x00000000000000000000000000000000000000c3');

test('an Auction on a ComplianceCheck no Deployment enforces raises AuctionComplianceCheckUnenforced until its window closes', async () => {
  const elsewhere = [
    onComplianceCheck(1, 'Scheduled', UNENFORCED),
    onComplianceCheck(2, 'Deposit', UNENFORCED),
    onComplianceCheck(3, 'Fulfillment', UNENFORCED),
    onComplianceCheck(4, 'Settlement', UNENFORCED),
    onComplianceCheck(5, 'Cancelled', UNENFORCED),
    onComplianceCheck(6, 'Deposit', ENFORCED),
  ];
  const { context } = chain({
    auctions: [],
    elsewhere,
    positions: [],
    flagged: [],
  });

  const result = await runEnforce(context, {
    ...config,
    enforcedComplianceChecks: new Set([OWN, ENFORCED]),
  });

  expect(result.findings.map((f) => [f.kind, f.key])).toEqual([
    ['AuctionComplianceCheckUnenforced', elsewhere[0].address],
    ['AuctionComplianceCheckUnenforced', elsewhere[1].address],
    ['AuctionComplianceCheckUnenforced', elsewhere[2].address],
  ]);
});

test('a Deployment without enforcedComplianceChecks leaves other ComplianceChecks to the Deployment that reports them', async () => {
  const { context } = chain({
    auctions: [],
    elsewhere: [onComplianceCheck(1, 'Deposit', UNENFORCED)],
    positions: [],
    flagged: [],
  });
  expect((await runEnforce(context, config)).findings).toEqual([]);
});
