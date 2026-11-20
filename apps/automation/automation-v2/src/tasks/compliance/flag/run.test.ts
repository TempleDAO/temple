import { expect, test } from 'vitest';
import type { Hash } from 'viem';
import type { Json } from '@mountainpath9/overlord-core';
import { LCAddress, lcAddress } from '../shared';
import { SourceState } from '../ingest';
import type { FlaggedAddressesIndexRead } from './flagged-addresses-index';
import { FlagConfig, FlagContext, runFlag } from './run';

const A = lcAddress('0x00000000000000000000000000000000000000aa');
const B = lcAddress('0x00000000000000000000000000000000000000bb');
const C = lcAddress('0x00000000000000000000000000000000000000cc');
const D = lcAddress('0x00000000000000000000000000000000000000dd');

const HEAD = 100n;

const config: FlagConfig = { maxFlagBatch: 200 };

/** A Source's stored state: Absent without `listed`, else listing it. */
function source(
  id: string,
  listed?: LCAddress[],
  status: 'fresh' | 'failing' = 'fresh'
): { id: string; state: SourceState } {
  if (!listed) return { id, state: SourceState.initial(0) };
  const snapshot = { addresses: listed, contentHash: '', firstSeenAtMs: 0 };
  return {
    id,
    state:
      status === 'fresh'
        ? { status, snapshot, confirmedAtMs: 0 }
        : { status, snapshot, confirmedAtMs: 0, problem: 'HTTP 503' },
  };
}

/** A Deployment as plain data, at head block HEAD. `setFlagged` records each batch in `sent`. */
function deployment(d: {
  sources: { id: string; state: SourceState }[];
  exempt?: Json;
  index?: Partial<FlaggedAddressesIndexRead>;
  flagged?: LCAddress[];
}): FlagContext & { sent: LCAddress[][] } {
  const sent: LCAddress[][] = [];
  const atHead = (block: bigint) => {
    if (block !== HEAD) throw new Error(`read at ${block}, not the head`);
  };
  return {
    sent,
    readHeadBlock: async () => HEAD,
    readSources: async () => d.sources,
    readExemptions: async () => d.exempt,
    readFlaggedAddressesIndex: async (atBlock) => {
      atHead(atBlock);
      return {
        flagged: new Set(),
        unflagged: new Set(),
        complete: true,
        ...d.index,
      };
    },
    readFlags: async (addresses, atBlock) => {
      atHead(atBlock);
      return new Set(addresses.filter((a) => d.flagged?.includes(a)));
    },
    setFlagged: async (batch) => {
      sent.push([...batch]);
      return `0x${String(sent.length).padStart(64, '0')}` as Hash;
    },
  };
}

test('flags the Target set that is not yet Flagged, and nothing else', async () => {
  const ctx = deployment({
    sources: [source('ofac-sdn', [A, B]), source('manual', [B, C], 'failing')],
    flagged: [B],
  });
  const run = await runFlag(ctx, config);
  expect(run.findings).toEqual([]);
  expect(ctx.sent).toEqual([[A, C]]);
});

test('an Exemption keeps a Listed address out of the Target set', async () => {
  const ctx = deployment({
    sources: [source('ofac-sdn', [A, B])],
    exempt: { [B.toUpperCase().replace('0X', '0x')]: 'legal review' },
  });
  await runFlag(ctx, config);
  expect(ctx.sent).toEqual([[A]]);
});

test('a Flagged Exempt address is an UnbackedFlag even while a Source is Absent', async () => {
  const run = await runFlag(
    deployment({
      sources: [source('ofac-sdn'), source('manual', [A])],
      exempt: { [B]: 'legal review' },
      flagged: [A, B],
    }),
    config
  );
  expect(run.findings).toContainEqual({
    kind: 'UnbackedFlag',
    key: B,
    summary: `${B} is Flagged but Exempt`,
  });
});

test('an Exemption with a bad address exempts nothing, one with no reason still exempts, and both raise ExemptionInvalid', async () => {
  const ctx = deployment({
    sources: [source('ofac-sdn', [A, B, C])],
    exempt: { '0xnope': 'typo', [C]: ' ' },
  });
  const run = await runFlag(ctx, config);
  expect(ctx.sent).toEqual([[A, B]]);
  expect(run.findings).toMatchObject([
    { kind: 'ExemptionInvalid', key: '0xnope (not an address)' },
    { kind: 'ExemptionInvalid', key: `${C} (no reason)` },
  ]);
});

test.each<[string, Json]>([
  ['an array', [B]],
  ['a string', B],
  ['a number', 1],
])(
  'compliance_exempt set to %s fails the run before any chain read',
  async (_, exempt) => {
    const ctx: FlagContext = {
      ...deployment({
        sources: [source('ofac-sdn', [A, B])],
        exempt,
      }),
      readHeadBlock: () => Promise.reject(new Error('read the chain')),
    };
    await expect(runFlag(ctx, config)).rejects.toThrow(
      'compliance_exempt is not a JSON object of address → reason'
    );
  }
);

test('an Absent Source still lets the others flag, and raises SourceAbsent', async () => {
  const ctx = deployment({
    sources: [source('ofac-sdn'), source('manual', [A])],
  });
  const run = await runFlag(ctx, config);
  expect(ctx.sent).toEqual([[A]]);
  expect(run.findings).toMatchObject([
    { kind: 'SourceAbsent', key: 'ofac-sdn' },
  ]);
});

test('while a Source is Absent, an address Flagged only in the index raises no UnbackedFlag', async () => {
  const ctx = deployment({
    sources: [source('ofac-sdn'), source('manual', [A])],
    index: { flagged: new Set([A, D]) },
    flagged: [A, D],
  });
  const run = await runFlag(ctx, config);
  expect(run.findings.map((f) => f.kind)).toEqual(['SourceAbsent']);
});

test('UnbackedFlag from the Flagged addresses index only for addresses still Flagged at head', async () => {
  const run = await runFlag(
    deployment({
      sources: [source('manual', [A])],
      // C was unflagged on-chain after the Watermark.
      index: { flagged: new Set([A, B, C]) },
      flagged: [A, B],
    }),
    config
  );
  expect(run.findings).toEqual([
    {
      kind: 'UnbackedFlag',
      key: B,
      summary: `${B} is Flagged but no Source lists it`,
    },
  ]);
});

test('sends the missing addresses in batches of at most maxFlagBatch, with a Notice per batch', async () => {
  const ctx = deployment({
    sources: [source('manual', [A, B, C, D])],
    flagged: [B],
  });
  const run = await runFlag(ctx, { ...config, maxFlagBatch: 2 });
  expect(ctx.sent).toEqual([[A, C], [D]]);
  expect(run.notices).toEqual([
    {
      kind: 'Flagged',
      addresses: [A, C],
      reflagged: [],
      txHash: `0x${'1'.padStart(64, '0')}`,
    },
    {
      kind: 'Flagged',
      addresses: [D],
      reflagged: [],
      txHash: `0x${'2'.padStart(64, '0')}`,
    },
  ]);
});

test('a Notice names the addresses it flags again after someone unflagged them', async () => {
  const ctx = deployment({
    sources: [source('manual', [A, B, C])],
    index: { unflagged: new Set([B, D]) },
  });
  const run = await runFlag(ctx, { ...config, maxFlagBatch: 2 });
  expect(run.notices.map((n) => [n.addresses, n.reflagged])).toEqual([
    [[A, B], [B]],
    [[C], []],
  ]);
});

test('a batch that fails stops sending, and the Notices of mined batches still come out', async () => {
  const ctx = deployment({
    sources: [source('manual', [A, B, C, D])],
  });
  const failure = new Error('replacement underpriced');
  const run = await runFlag(
    {
      ...ctx,
      setFlagged: async (batch) => {
        if (ctx.sent.length === 1) throw failure;
        return ctx.setFlagged(batch);
      },
    },
    { ...config, maxFlagBatch: 2 }
  );
  expect(ctx.sent).toEqual([[A, B]]);
  expect(run.notices).toEqual([
    {
      kind: 'Flagged',
      addresses: [A, B],
      reflagged: [],
      txHash: `0x${'1'.padStart(64, '0')}`,
    },
  ]);
  expect(run.sendFailure).toBe(failure);
});

test('nothing missing: nothing sent and no Notice', async () => {
  const ctx = deployment({
    sources: [source('manual', [A])],
    flagged: [A],
  });
  expect((await runFlag(ctx, config)).notices).toEqual([]);
  expect(ctx.sent).toEqual([]);
});
