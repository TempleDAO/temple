import type { Finding } from '../attention';
import type { SourceFetch, SourceLimits } from './sources';
import {
  IngestEvent,
  SnapshotChange,
  sourceFindings,
  SourceState,
  transition,
} from './state';

/**
 * Everything an ingest run touches for one Source, as small functions. The
 * task builds it from Overlord's KV and the Source; tests build it from
 * plain data.
 */
export interface IngestContext {
  /** The Source state as the last run persisted it, or undefined if it never ran. */
  readState(): Promise<SourceState | undefined>;
  /** The Source's cheap change check, if it has one. */
  latestVersion?(): Promise<string>;
  /** Fetches and parses the Source's latest Publication. */
  fetch(): Promise<SourceFetch>;
  /** The current time, read once per run. */
  nowMs(): number;
}

export interface IngestConfig {
  /** The Source's id: the key of its Findings. */
  sourceId: string;
  limits: SourceLimits;
}

export interface IngestRun {
  /** The state the run started from. */
  previous: SourceState;
  /** The one event this run applied. */
  event: IngestEvent;
  /** The next state, for the task to persist. */
  next: SourceState;
  /** Set when the Snapshot's content changed; the task posts it as a Notice. */
  change?: SnapshotChange;
  findings: Finding[];
}

/**
 * One ingest run for a Source: probe, maybe fetch, apply exactly one event
 * to the state machine, and derive the Findings. Persists nothing and never
 * touches the chain.
 */
export async function runIngest(
  ctx: IngestContext,
  config: IngestConfig
): Promise<IngestRun> {
  const nowMs = ctx.nowMs();
  const previous = (await ctx.readState()) ?? SourceState.initial(nowMs);

  let event: IngestEvent;
  try {
    const latest = await ctx.latestVersion?.();
    const probed = IngestEvent.probe(previous, latest, nowMs);
    event =
      probed === 'fetch'
        ? { kind: 'fetched', atMs: nowMs, ...(await ctx.fetch()) }
        : probed;
  } catch (e) {
    event = {
      kind: 'failed',
      atMs: nowMs,
      error: String(e).slice(0, CHECK_ERROR_MAX_CHARS),
    };
  }

  const { state: next, change } = transition(previous, event, config.limits);
  return {
    previous,
    event,
    next,
    ...(change && { change }),
    findings: sourceFindings(config.sourceId, next, config.limits, nowMs),
  };
}

/** How much of a failed check's error the Source state keeps (`problem`). */
const CHECK_ERROR_MAX_CHARS = 300;
