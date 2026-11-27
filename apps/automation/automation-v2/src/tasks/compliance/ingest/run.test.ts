import { expect, test } from 'vitest';
import { IngestConfig, IngestContext, runIngest } from './run';
import type { SourceFetch } from './sources';
import type { SourceState } from './state';

const A = '0x00000000000000000000000000000000000000aa';
const B = '0x00000000000000000000000000000000000000bb';
const C = '0x00000000000000000000000000000000000000cc';
const D = '0x00000000000000000000000000000000000000dd';

const config: IngestConfig = {
  sourceId: 'ofac-sdn',
  limits: { minCount: 2, maxDropPerPublication: 1, unconfirmedAfterSecs: 60 },
};

/** A Source as plain data. `fetched` counts the downloads. */
function source(s: {
  state?: SourceState;
  latest?: string | Error;
  publication?: SourceFetch | Error;
  now?: number;
}): IngestContext & { fetched: number } {
  const ctx = {
    fetched: 0,
    readState: async () => s.state,
    fetch: async () => {
      ctx.fetched++;
      if (s.publication instanceof Error) throw s.publication;
      return s.publication ?? { addresses: [] };
    },
    nowMs: () => s.now ?? 1_000,
  };
  const latest = s.latest;
  // Assign, not spread: a copy's `fetched` would never count.
  return latest === undefined
    ? ctx
    : Object.assign(ctx, {
        latestVersion: async () => {
          if (latest instanceof Error) throw latest;
          return latest;
        },
      });
}

test('a first good fetch makes the Source fresh, with everything added', async () => {
  const run = await runIngest(
    source({ publication: { addresses: [B, A], version: 'v1' } }),
    config
  );
  expect(run.next).toMatchObject({
    status: 'fresh',
    confirmedAtMs: 1_000,
    snapshot: { addresses: [A, B], version: 'v1', firstSeenAtMs: 1_000 },
  });
  expect(run.change).toEqual({ added: [A, B], removed: [] });
  expect(run.findings).toEqual([]);
});

/** The state a first good fetch of `addresses` at version `v1` leaves. */
const freshV1 = async (addresses: string[]) =>
  (
    await runIngest(
      source({ now: 0, publication: { addresses, version: 'v1' } }),
      config
    )
  ).next;

test('an unchanged version confirms the Snapshot without downloading it', async () => {
  const ctx = source({ state: await freshV1([A, B]), latest: 'v1' });
  const run = await runIngest(ctx, config);
  expect(ctx.fetched).toBe(0);
  expect(run.event).toEqual({ kind: 'unchanged', atMs: 1_000 });
  expect(run.next).toMatchObject({ status: 'fresh', confirmedAtMs: 1_000 });
  expect(run.change).toBeUndefined();
  expect(run.findings).toEqual([]);
});

test('a failed fetch keeps the Snapshot, and goes Unconfirmed once the last success is old', async () => {
  const state = await freshV1([A, B]);
  const failing = (now: number) =>
    runIngest(
      source({ state, publication: new Error('503 from publisher'), now }),
      config
    );

  const soon = await failing(59_999);
  expect(soon.next).toMatchObject({
    status: 'failing',
    confirmedAtMs: 0,
    snapshot: { addresses: [A, B] },
    problem: 'Error: 503 from publisher',
  });
  expect(soon.change).toBeUndefined();
  expect(soon.findings).toEqual([]);

  expect((await failing(60_000)).findings).toEqual([
    {
      kind: 'SourceUnconfirmed',
      key: 'ofac-sdn',
      summary:
        'no successful check since 1970-01-01T00:00:00.000Z: Error: 503 from publisher',
    },
  ]);
});

test('a Publication that breaks a Limit is rejected at once and the Snapshot stands', async () => {
  const ctx = source({
    state: await freshV1([A, B, C]),
    latest: 'v2',
    publication: { addresses: [A], version: 'v2' },
  });
  const run = await runIngest(ctx, config);
  expect(run.next).toMatchObject({
    status: 'rejected',
    snapshot: { addresses: [A, B, C], version: 'v1' },
    rejectedVersion: 'v2',
  });
  expect(run.change).toBeUndefined();
  expect(run.findings).toEqual([
    {
      kind: 'SourceRejected',
      key: 'ofac-sdn',
      summary: '1 addresses, fewer than minCount 2',
    },
  ]);

  const again = source({ state: run.next, latest: 'v2' });
  expect((await runIngest(again, config)).event.kind).toBe('stillRejected');
  expect(again.fetched).toBe(0);
});

test('a Publication that drops more than maxDropPerPublication is rejected and the Snapshot stands', async () => {
  const run = await runIngest(
    source({
      state: await freshV1([A, B, C, D]),
      publication: { addresses: [A, B], version: 'v2' },
    }),
    config
  );
  expect(run.next).toMatchObject({
    status: 'rejected',
    snapshot: { addresses: [A, B, C, D], version: 'v1' },
  });
  expect(run.change).toBeUndefined();
  expect(run.findings).toEqual([
    {
      kind: 'SourceRejected',
      key: 'ofac-sdn',
      summary: '2 addresses removed, more than maxDropPerPublication 1',
    },
  ]);
});

test('latestVersion throwing fails the check without fetching', async () => {
  const ctx = source({
    state: await freshV1([A, B]),
    latest: new Error('timeout'),
    publication: { addresses: [A, B, C], version: 'v2' },
  });
  const run = await runIngest(ctx, config);
  expect(ctx.fetched).toBe(0);
  expect(run.event).toEqual({
    kind: 'failed',
    atMs: 1_000,
    error: 'Error: timeout',
  });
  expect(run.next).toMatchObject({
    status: 'failing',
    snapshot: { addresses: [A, B] },
  });
});

test('a new version that fails to download or parse is not fetched again within FailedVersion.RETRY_MS', async () => {
  const run = await runIngest(
    source({
      state: await freshV1([A, B]),
      latest: 'v2',
      publication: new Error('Record_Count 3 but 2 entries'),
    }),
    config
  );
  expect(run.next).toMatchObject({
    status: 'failing',
    failedVersion: { version: 'v2', atMs: 1_000 },
  });

  const again = source({ state: run.next, latest: 'v2', now: 2_000 });
  const second = await runIngest(again, config);
  expect(second.event).toEqual({ kind: 'stillFailing', atMs: 2_000 });
  expect(second.next).toEqual(run.next);
  expect(again.fetched).toBe(0);
});
