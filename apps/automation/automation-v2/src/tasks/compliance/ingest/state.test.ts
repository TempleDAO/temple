import { expect, test } from 'vitest';
import type { SourceLimits } from './sources';
import {
  FailedVersion,
  IngestEvent,
  sourceFindings,
  SourceState,
  transition,
} from './state';

const A = '0x00000000000000000000000000000000000000aa';
const B = '0x00000000000000000000000000000000000000bb';
const C = '0x00000000000000000000000000000000000000cc';
const limits: SourceLimits = {
  minCount: 2,
  maxDropPerPublication: 1,
  unconfirmedAfterSecs: 60,
};

const fetched = (atMs: number, addresses: string[], version?: string) =>
  ({ kind: 'fetched', atMs, addresses, version }) as const;

function fresh(addresses: string[], version = 'v1'): SourceState {
  return transition(
    SourceState.initial(0),
    fetched(0, addresses, version),
    limits
  ).state;
}

test('first good fetch: absent → fresh, everything counts as added', () => {
  const { state, change } = transition(
    SourceState.initial(0),
    fetched(1, [B.toUpperCase().replace('0X', '0x'), A, A], 'v1'),
    limits
  );
  expect(state.status).toBe('fresh');
  expect(SourceState.snapshot(state)?.addresses).toEqual([A, B]);
  expect(change).toEqual({ added: [A, B], removed: [] });
});

test('a failure never turns a Snapshot into "empty": fresh → failing keeps the Snapshot', () => {
  const before = fresh([A, B]);
  const { state } = transition(
    before,
    { kind: 'failed', atMs: 5, error: 'HTTP 503' },
    limits
  );
  expect(state.status).toBe('failing');
  expect(SourceState.snapshot(state)).toEqual(SourceState.snapshot(before));
});

test('an entry the source refused rejects the whole Publication', () => {
  const before = fresh([A, B]);
  const { state } = transition(
    before,
    { ...fetched(1, [A, B, C], 'v2'), invalid: [`${C} (no reason)`] },
    limits
  );
  expect(state).toMatchObject({
    status: 'rejected',
    problem: `invalid entries: ${C} (no reason)`,
  });
  expect(SourceState.snapshot(state)).toEqual(SourceState.snapshot(before));
});

test('a fetch breaking a limit is rejected and the Snapshot still stands', () => {
  const before = fresh([A, B, C]);
  const { state, change } = transition(before, fetched(5, [A], 'v2'), limits);
  expect(state).toMatchObject({ status: 'rejected', rejectedVersion: 'v2' });
  expect(SourceState.snapshot(state)).toEqual(SourceState.snapshot(before));
  expect(change).toBeUndefined();
});

test('one invalid entry rejects the whole fetch', () => {
  const { state } = transition(
    fresh([A, B]),
    fetched(5, [A, B, '0xnope']),
    limits
  );
  expect(state.status).toBe('rejected');
});

test('a source that never succeeded stays absent, with the reason', () => {
  const { state } = transition(SourceState.initial(0), fetched(1, [A]), limits);
  expect(state).toMatchObject({
    status: 'absent',
    problem: '1 addresses, fewer than minCount 2',
    problemStatus: 'rejected',
  });
});

test('same content under a new version is fresh with no change', () => {
  const { state, change } = transition(
    fresh([A, B], 'v1'),
    fetched(5, [B, A], 'v2'),
    limits
  );
  expect(state.status).toBe('fresh');
  expect(SourceState.snapshot(state)?.version).toBe('v2');
  expect(change).toBeUndefined();
});

test('latestVersion() decides whether to download', () => {
  const state = fresh([A, B], 'v1');
  expect(IngestEvent.probe(state, undefined, 9)).toBe('fetch');
  expect(IngestEvent.probe(state, 'v1', 9)).toEqual({
    kind: 'unchanged',
    atMs: 9,
  });
  expect(IngestEvent.probe(state, 'v2', 9)).toBe('fetch');

  const rejected = transition(state, fetched(5, [], 'v2'), limits).state;
  expect(IngestEvent.probe(rejected, 'v2', 9)).toEqual({
    kind: 'stillRejected',
    atMs: 9,
  });
});

test('failing raises SourceUnconfirmed only after unconfirmedAfterSecs since the last good check', () => {
  const failing = transition(
    fresh([A, B]),
    { kind: 'failed', atMs: 1_000, error: 'x' },
    limits
  ).state;
  expect(sourceFindings('s', failing, limits, 59_000)).toEqual([]);
  expect(sourceFindings('s', failing, limits, 60_000)).toMatchObject([
    { kind: 'SourceUnconfirmed', key: 's' },
  ]);
});

test('an Absent Source goes Unconfirmed once unconfirmedAfterSecs have passed since it was first seen', () => {
  const absent = transition(
    SourceState.initial(1_000),
    { kind: 'failed', atMs: 2_000, error: 'x' },
    limits
  ).state;
  expect(sourceFindings('s', absent, limits, 60_999)).toEqual([]);
  expect(sourceFindings('s', absent, limits, 61_000)).toMatchObject([
    { kind: 'SourceUnconfirmed', key: 's' },
  ]);
});

test('an Absent Source whose Publication was rejected raises SourceRejected, and keeps it through a failed check', () => {
  const steps: IngestEvent[] = [
    fetched(1, [A], 'v2'),
    { kind: 'failed', atMs: 2, error: 'HTTP 503' },
    { kind: 'stillRejected', atMs: 3 },
  ];
  let state = SourceState.initial(0);
  for (const event of steps) {
    state = transition(state, event, limits).state;
    expect(state.status).toBe('absent');
    expect(sourceFindings('s', state, limits, 3)).toMatchObject([
      { kind: 'SourceRejected', key: 's' },
    ]);
  }
});

test('rejected raises SourceRejected at once', () => {
  const rejected = transition(fresh([A, B]), fetched(5, []), limits).state;
  expect(sourceFindings('s', rejected, limits, 5)).toMatchObject([
    { kind: 'SourceRejected' },
  ]);
});

test('a failing Source skips the version that failed, and fetches a new one', () => {
  const failing = transition(
    fresh([A, B], 'v1'),
    { kind: 'failed', atMs: 10, error: 'truncated SDN.XML', version: 'v2' },
    limits
  ).state;
  expect(failing).toMatchObject({
    status: 'failing',
    failedVersion: { version: 'v2', atMs: 10 },
  });
  expect(IngestEvent.probe(failing, 'v2', 20)).toEqual({
    kind: 'stillFailing',
    atMs: 20,
  });
  expect(IngestEvent.probe(failing, 'v3', 20)).toBe('fetch');
  expect(IngestEvent.probe(failing, 'v2', 10 + FailedVersion.RETRY_MS)).toBe(
    'fetch'
  );
});

test('a failed version check keeps the failed version and its cooldown', () => {
  const failing = transition(
    fresh([A, B], 'v1'),
    { kind: 'failed', atMs: 10, error: 'truncated SDN.XML', version: 'v2' },
    limits
  ).state;
  const checkFailed = transition(
    failing,
    { kind: 'failed', atMs: 20, error: 'version check: HTTP 503' },
    limits
  ).state;
  expect(checkFailed).toMatchObject({
    status: 'failing',
    failedVersion: { version: 'v2', atMs: 10 },
  });
  expect(IngestEvent.probe(checkFailed, 'v2', 30)).toEqual({
    kind: 'stillFailing',
    atMs: 30,
  });
});

test('a Rejected or Absent Source also skips a version that failed', () => {
  const failedV3 = {
    kind: 'failed',
    atMs: 10,
    error: 'truncated',
    version: 'v3',
  } as const;
  const rejected = transition(
    fresh([A, B]),
    fetched(5, [], 'v2'),
    limits
  ).state;
  const absent = SourceState.initial(0);
  for (const state of [rejected, absent]) {
    const next = transition(state, failedV3, limits).state;
    expect(next.status).toBe(state.status);
    expect(IngestEvent.probe(next, 'v3', 20)).toEqual({
      kind: 'stillFailing',
      atMs: 20,
    });
  }
});
