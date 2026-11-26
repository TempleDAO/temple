import { createHash } from 'node:crypto';
import { Address, isAddress } from 'viem';
import { assertNever } from '@/tlc/assert-never';
import type { Finding } from '../attention';
import { LCAddress, lcAddress, listUpTo } from '../shared';
import type { SourceLimits } from './sources';

/** The address set last accepted from one Source. Addresses are deduped and sorted. */
export interface Snapshot {
  addresses: LCAddress[];
  /** sha256 of the sorted addresses: the only meaning of "changed". */
  contentHash: string;
  /** The publisher's version when this content was fetched, if it has one. */
  version?: string;
  firstSeenAtMs: number;
}

/**
 * The state of one Source, persisted in KV by its ingest task.
 *
 * - absent:   no Snapshot has ever been accepted. Unknown, never "empty".
 * - fresh:    the last check succeeded and passed the Limits.
 * - failing:  the last check failed; the Snapshot still stands.
 * - rejected: the latest Publication broke the Limits; the Snapshot still stands.
 *
 * `confirmedAtMs` is the last successful check, the clock for
 * SourceUnconfirmed; an absent Source uses `absentSinceMs`.
 * `problem` is why the last attempt failed or was rejected; on absent,
 * `problemStatus` says which.
 * `rejectedVersion` lets a Source with `latestVersion()` skip re-downloading
 * a Publication it already rejected, and `failedVersion` one whose download
 * or parse failed, until `FailedVersion.RETRY_MS` has passed.
 */
export type SourceState =
  | {
      status: 'absent';
      absentSinceMs: number;
      problem?: string;
      problemStatus?: 'failing' | 'rejected';
      rejectedVersion?: string;
      failedVersion?: FailedVersion;
    }
  | { status: 'fresh'; snapshot: Snapshot; confirmedAtMs: number }
  | {
      status: 'failing';
      snapshot: Snapshot;
      confirmedAtMs: number;
      problem: string;
      failedVersion?: FailedVersion;
    }
  | {
      status: 'rejected';
      snapshot: Snapshot;
      confirmedAtMs: number;
      problem: string;
      rejectedVersion?: string;
      failedVersion?: FailedVersion;
    };

/** A version whose fetch failed, and when. */
export interface FailedVersion {
  version: string;
  atMs: number;
}

export const FailedVersion = {
  /**
   * How long a run skips a version that failed. Long enough not to download
   * a ~30 MB Publication every minute, short enough to retry a transient
   * network error well within `unconfirmedAfterSecs`.
   */
  RETRY_MS: 60 * 60 * 1000,
  /** The failure a `failed` event records, if it knows the version. */
  from(event: { version?: string; atMs: number }): FailedVersion | undefined {
    return event.version === undefined
      ? undefined
      : { version: event.version, atMs: event.atMs };
  },
  /**
   * The failed version to keep after a `failed` event: the event's own, or,
   * when the version check itself failed, the one already held, so its
   * cooldown isn't reset.
   */
  after(
    event: { version?: string; atMs: number },
    held: FailedVersion | undefined
  ): FailedVersion | undefined {
    return FailedVersion.from(event) ?? held;
  },
  /** Whether `latest` failed less than RETRY_MS before `atMs`. */
  holds(f: FailedVersion | undefined, latest: string, atMs: number): boolean {
    return f?.version === latest && atMs - f.atMs < FailedVersion.RETRY_MS;
  },
};

/** What a run observed. The ingest task produces exactly one per run. */
export type IngestEvent =
  /** `latestVersion()` matched the Snapshot's version: nothing to download. */
  | { kind: 'unchanged'; atMs: number }
  /** `latestVersion()` matched a version already rejected: still rejected. */
  | { kind: 'stillRejected'; atMs: number }
  /** `latestVersion()` matched a version that failed within RETRY_MS: skipped. */
  | { kind: 'stillFailing'; atMs: number }
  | {
      kind: 'fetched';
      atMs: number;
      addresses: readonly string[];
      /** Entries the Source refused; any rejects the Publication. */
      invalid?: readonly string[];
      version?: string;
    }
  | {
      kind: 'failed';
      atMs: number;
      error: string;
      /** The `latestVersion()` this run was fetching, if any. */
      version?: string;
    };

export interface SnapshotChange {
  added: LCAddress[];
  removed: LCAddress[];
}

export const SourceState = {
  /** A Source that has never produced a Snapshot. */
  initial: (nowMs: number): SourceState => ({
    status: 'absent',
    absentSinceMs: nowMs,
  }),
  /** Its last accepted Snapshot; undefined only when Absent. */
  snapshot(s: SourceState): Snapshot | undefined {
    switch (s.status) {
      case 'absent':
        return undefined;
      case 'fresh':
      case 'failing':
      case 'rejected':
        return s.snapshot;
      default:
        return assertNever(s);
    }
  },
};

export const IngestEvent = {
  /**
   * Decides whether the run fetches the latest Publication, given the result
   * of `latestVersion()` (undefined when the Source has none).
   */
  probe(
    state: SourceState,
    latest: string | undefined,
    atMs: number
  ): IngestEvent | 'fetch' {
    if (latest === undefined) return 'fetch';
    if (SourceState.snapshot(state)?.version === latest)
      return { kind: 'unchanged', atMs };
    switch (state.status) {
      case 'absent':
      case 'rejected':
        if (state.rejectedVersion === latest)
          return { kind: 'stillRejected', atMs };
        break;
      case 'fresh':
      case 'failing':
        break;
      default:
        return assertNever(state);
    }
    return state.status !== 'fresh' &&
      FailedVersion.holds(state.failedVersion, latest, atMs)
      ? { kind: 'stillFailing', atMs }
      : 'fetch';
  },
};

/** Checks a fetched Publication against the Limits and the last Snapshot. */
export function checkFetch(
  raw: readonly string[],
  last: Snapshot | undefined,
  limits: SourceLimits,
  invalid: readonly string[] = []
): { ok: true; addresses: LCAddress[] } | { ok: false; problem: string } {
  const valid: Address[] = [];
  const refused = [...invalid];
  for (const a of raw)
    if (isAddress(a, { strict: false })) valid.push(a);
    else refused.push(a);
  if (refused.length)
    return {
      ok: false,
      problem: `invalid entries: ${listUpTo(refused, 5)}`,
    };

  const addresses = [...new Set(valid.map(lcAddress))].sort();
  if (addresses.length < limits.minCount)
    return {
      ok: false,
      problem: `${addresses.length} addresses, fewer than minCount ${limits.minCount}`,
    };

  if (last) {
    const fetched = new Set(addresses);
    const dropped = last.addresses.filter((a) => !fetched.has(a)).length;
    if (dropped > limits.maxDropPerPublication)
      return {
        ok: false,
        problem: `${dropped} addresses removed, more than maxDropPerPublication ${limits.maxDropPerPublication}`,
      };
  }
  return { ok: true, addresses };
}

/**
 * The Source state machine. Pure: the ingest task persists the result.
 *
 *   absent ──good──▶ fresh;  fresh, failing ──failed──▶ failing;  rejected ──failed──▶ rejected
 *   fresh, failing, rejected ──bad──▶ rejected;  absent stays absent on failure or rejection
 *   failing, rejected ──good / unchanged──▶ fresh
 *
 * `change` is set when the Snapshot's content changed.
 */
export function transition(
  state: SourceState,
  event: IngestEvent,
  limits: SourceLimits
): { state: SourceState; change?: SnapshotChange } {
  const last = SourceState.snapshot(state);

  switch (event.kind) {
    case 'unchanged':
      return last
        ? {
            state: {
              status: 'fresh',
              snapshot: last,
              confirmedAtMs: event.atMs,
            },
          }
        : { state };

    case 'stillRejected':
    case 'stillFailing':
      return { state };

    case 'failed':
      switch (state.status) {
        case 'absent':
          // A rejection outlives a failed check: SourceRejected stays open.
          if (state.problemStatus === 'rejected')
            return {
              state: {
                ...state,
                failedVersion: FailedVersion.after(event, state.failedVersion),
              },
            };
          return {
            state: {
              ...state,
              problem: event.error,
              problemStatus: 'failing',
              failedVersion: FailedVersion.after(event, state.failedVersion),
            },
          };
        case 'rejected':
          return {
            state: {
              ...state,
              failedVersion: FailedVersion.after(event, state.failedVersion),
            },
          };
        case 'fresh':
        case 'failing':
          return {
            state: {
              status: 'failing',
              snapshot: state.snapshot,
              confirmedAtMs: state.confirmedAtMs,
              problem: event.error,
              failedVersion: FailedVersion.after(
                event,
                state.status === 'failing' ? state.failedVersion : undefined
              ),
            },
          };
        default:
          return assertNever(state);
      }

    case 'fetched': {
      const checked = checkFetch(event.addresses, last, limits, event.invalid);
      if (!checked.ok) {
        switch (state.status) {
          case 'absent':
            return {
              state: {
                status: 'absent',
                absentSinceMs: state.absentSinceMs,
                problem: checked.problem,
                problemStatus: 'rejected',
                rejectedVersion: event.version,
              },
            };
          case 'fresh':
          case 'failing':
          case 'rejected':
            return {
              state: {
                status: 'rejected',
                snapshot: state.snapshot,
                confirmedAtMs: state.confirmedAtMs,
                problem: checked.problem,
                rejectedVersion: event.version,
              },
            };
          default:
            return assertNever(state);
        }
      }
      const contentHash = hashAddresses(checked.addresses);
      const snapshot: Snapshot =
        last?.contentHash === contentHash
          ? { ...last, version: event.version }
          : {
              addresses: checked.addresses,
              contentHash,
              version: event.version,
              firstSeenAtMs: event.atMs,
            };
      return {
        state: { status: 'fresh', snapshot, confirmedAtMs: event.atMs },
        change: diff(last, snapshot),
      };
    }

    default:
      return assertNever(event);
  }
}

/** Findings for one Source, derived from its state alone. */
export function sourceFindings(
  sourceId: string,
  state: SourceState,
  limits: SourceLimits,
  nowMs: number
): Finding[] {
  const unconfirmedMs = limits.unconfirmedAfterSecs * 1000;
  switch (state.status) {
    case 'fresh':
      return [];
    case 'rejected':
      return [
        { kind: 'SourceRejected', key: sourceId, summary: state.problem },
      ];
    case 'failing':
      return nowMs - state.confirmedAtMs >= unconfirmedMs
        ? [
            {
              kind: 'SourceUnconfirmed',
              key: sourceId,
              summary: `no successful check since ${new Date(state.confirmedAtMs).toISOString()}: ${state.problem}`,
            },
          ]
        : [];
    case 'absent':
      if (state.problem !== undefined && state.problemStatus === 'rejected')
        return [
          {
            kind: 'SourceRejected',
            key: sourceId,
            summary: state.problem,
          },
        ];
      return nowMs - state.absentSinceMs >= unconfirmedMs
        ? [
            {
              kind: 'SourceUnconfirmed',
              key: sourceId,
              summary: `never fetched successfully: ${state.problem ?? 'no attempt completed'}`,
            },
          ]
        : [];
    default:
      return assertNever(state);
  }
}

/** sha256 of the addresses, sorted here so the caller's order never matters. */
function hashAddresses(addresses: readonly LCAddress[]): string {
  return createHash('sha256')
    .update([...addresses].sort().join('\n'))
    .digest('hex');
}

function diff(
  before: Snapshot | undefined,
  after: Snapshot
): SnapshotChange | undefined {
  if (before?.contentHash === after.contentHash) return;
  const was = new Set(before?.addresses);
  const is = new Set(after.addresses);
  return {
    added: after.addresses.filter((a) => !was.has(a)),
    removed: before ? before.addresses.filter((a) => !is.has(a)) : [],
  };
}
