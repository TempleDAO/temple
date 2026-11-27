import type { TaskContext } from '@mountainpath9/overlord-core';
import { runTask } from '../attention';
import { listUpTo } from '../shared';
import { IngestContext, runIngest } from './run';
import type { ComplianceSource } from './sources';
import type { SnapshotChange, SourceState } from './state';
import { readSourceState, writeSourceState } from './store';

/**
 * Each run builds the production context, calls `runIngest`, hands its
 * Findings and its Notice, when the Snapshot changed, to attention, and
 * then persists the next state. Never touches the chain.
 */
export function ingestTask(source: ComplianceSource) {
  return {
    id: `compliance-ingest-${source.id}`,
    action: async (ctx: TaskContext) => {
      const ingested: { next?: SourceState } = {};
      const result = await runTask(
        ctx,
        `ingest:${source.id}`,
        async () => {
          const run = await runIngest(productionIngestContext(ctx, source), {
            sourceId: source.id,
            limits: source.limits,
          });
          ingested.next = run.next;
          ctx.logger.info(
            `${source.id}: ${run.previous.status} → ${run.next.status} (${run.event.kind})`
          );
          return {
            findings: run.findings,
            notices: run.change ? [run.change] : [],
          };
        },
        (change) => noticeText(source.description, change)
      );
      // Only once the Notice is posted: a failed post leaves the old state,
      // so the next run sees the same change and posts it again.
      if (ingested.next) await writeSourceState(ctx, source.id, ingested.next);
      return result;
    },
  };
}

/** The production IngestContext: Overlord's KV, the Source, and the wall clock. */
function productionIngestContext(
  ctx: TaskContext,
  source: ComplianceSource
): IngestContext {
  return {
    readState: () => readSourceState(ctx, source.id),
    ...(source.versioned && {
      latestVersion: () => source.latestVersion(ctx),
    }),
    fetch: () => source.fetch(ctx),
    nowMs: () => Date.now(),
  };
}

/** The Notice text a Snapshot change posts, for the Source described. */
function noticeText(description: string, change: SnapshotChange): string {
  return (
    `${description}: ${change.added.length} added, ${change.removed.length} removed` +
    (change.added.length
      ? `\nadded: ${listUpTo(change.added, NOTICE_LIST_MAX)}`
      : '') +
    (change.removed.length
      ? `\nremoved: ${listUpTo(change.removed, NOTICE_LIST_MAX)}`
      : '')
  );
}

const NOTICE_LIST_MAX = 10;
