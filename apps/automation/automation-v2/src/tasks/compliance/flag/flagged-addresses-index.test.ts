import { expect, test } from 'vitest';
import { LCAddress, lcAddress } from '../shared';
import {
  FlaggedAddressesIndexConfig,
  FlaggedAddressesIndexState,
  FlaggedSetLog,
  scanFlaggedAddressesIndex,
} from './flagged-addresses-index';

const A = lcAddress('0x00000000000000000000000000000000000000aa');
const B = lcAddress('0x00000000000000000000000000000000000000bb');

const config: FlaggedAddressesIndexConfig = {
  deployBlock: 100n,
  confirmations: 10n,
  chunkBlocks: 50n,
  maxChunksPerRun: 3,
};

const log = (
  account: LCAddress,
  flagged: boolean,
  blockNumber: bigint,
  logIndex = 0
): FlaggedSetLog => ({ account, flagged, blockNumber, logIndex });

/** A chain's FlaggedSet logs and a KV slot as plain data. */
function chain(logs: FlaggedSetLog[], saved?: FlaggedAddressesIndexState) {
  const calls: [bigint, bigint][] = [];
  const writes: FlaggedAddressesIndexState[] = [];
  let state = saved;
  return {
    calls,
    writes,
    context: {
      readState: async () => state,
      writeState: async (s: FlaggedAddressesIndexState) => {
        writes.push(s);
        state = s;
      },
      getLogs: async (from: bigint, to: bigint) => {
        calls.push([from, to]);
        return logs.filter((l) => l.blockNumber >= from && l.blockNumber <= to);
      },
    },
  };
}

test('scans from the deploy block to head minus confirmations, saving after each chunk', async () => {
  const { context, calls, writes } = chain([
    log(A, true, 120n),
    log(B, true, 160n),
  ]);

  const read = await scanFlaggedAddressesIndex(context, config, 210n);

  expect(calls).toEqual([
    [100n, 149n],
    [150n, 199n],
    [200n, 200n],
  ]);
  expect(writes.map((w) => w.watermark)).toEqual([149n, 199n, 200n]);
  expect(read).toEqual({
    flagged: new Set([A, B]),
    unflagged: new Set(),
    complete: true,
  });
});

test('continues from the saved Watermark, and an unflag moves the account to unflagged', async () => {
  const { context, calls, writes } = chain([log(A, false, 205n)], {
    watermark: 200n,
    flagged: [A, B],
    unflagged: [],
  });

  const read = await scanFlaggedAddressesIndex(context, config, 220n);

  expect(calls).toEqual([[201n, 210n]]);
  expect(writes.map((w) => w.watermark)).toEqual([210n]);
  expect(read).toEqual({
    flagged: new Set([B]),
    unflagged: new Set([A]),
    complete: true,
  });
});

test('flagging an unflagged account again takes it off unflagged', async () => {
  const { context } = chain([log(A, true, 205n)], {
    watermark: 200n,
    flagged: [B],
    unflagged: [A],
  });
  const read = await scanFlaggedAddressesIndex(context, config, 220n);
  expect(read.flagged).toEqual(new Set([A, B]));
  expect(read.unflagged).toEqual(new Set());
});

test('logs apply in chain order whatever order the provider returns them', async () => {
  const { context } = chain([
    log(A, true, 130n, 1),
    log(A, false, 130n, 0),
    log(B, false, 140n),
    log(B, true, 120n),
  ]);
  const read = await scanFlaggedAddressesIndex(context, config, 160n);
  expect(read.flagged).toEqual(new Set([A]));
  expect(read.unflagged).toEqual(new Set([B]));
});

test('a long backfill stops after maxChunksPerRun and reads as incomplete', async () => {
  const { context, calls, writes } = chain([]);
  const read = await scanFlaggedAddressesIndex(context, config, 10_000n);
  expect(calls).toHaveLength(3);
  expect(writes.at(-1)?.watermark).toBe(249n);
  expect(read.complete).toBe(false);
});

test('a caught-up index makes no call and keeps its Watermark', async () => {
  const { context, calls, writes } = chain([], {
    watermark: 200n,
    flagged: [A],
    unflagged: [B],
  });
  const read = await scanFlaggedAddressesIndex(context, config, 205n);
  expect(calls).toEqual([]);
  expect(writes).toEqual([]);
  expect(read).toEqual({
    flagged: new Set([A]),
    unflagged: new Set([B]),
    complete: true,
  });
});
