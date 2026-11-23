import type { TaskContext } from '@mountainpath9/overlord-core';
import { z } from 'zod';
import { lcAddressSchema } from '../shared';
import type { SourceState } from './state';

/** The persisted state, or undefined when the Source has never run. */
export async function readSourceState(
  ctx: TaskContext,
  sourceId: string
): Promise<SourceState | undefined> {
  const saved = await ctx.kvGet(sourceStateKey(sourceId));
  return saved === undefined ? undefined : sourceStateSchema.parse(saved);
}

export async function writeSourceState(
  ctx: TaskContext,
  sourceId: string,
  state: SourceState
): Promise<void> {
  // JSON round trip drops undefined optionals, which jsonb can't store.
  await ctx.kvSet(sourceStateKey(sourceId), JSON.parse(JSON.stringify(state)));
}

/**
 * Source states live in Overlord KV (a Postgres jsonb column), one key per
 * Source. The ingest task of that Source is the only writer; flag tasks
 * only read.
 */
const sourceStateKey = (sourceId: string) => `compliance/source/${sourceId}`;

const snapshotSchema = z.object({
  addresses: z.array(lcAddressSchema),
  contentHash: z.string(),
  version: z.string().optional(),
  firstSeenAtMs: z.number(),
});

const failedVersionSchema = z.object({
  version: z.string(),
  atMs: z.number(),
});

const sourceStateSchema: z.ZodType<SourceState, z.ZodTypeDef, unknown> =
  z.discriminatedUnion('status', [
    z.object({
      status: z.literal('absent'),
      absentSinceMs: z.number(),
      problem: z.string().optional(),
      problemStatus: z.enum(['failing', 'rejected']).optional(),
      rejectedVersion: z.string().optional(),
      failedVersion: failedVersionSchema.optional(),
    }),
    z.object({
      status: z.literal('fresh'),
      snapshot: snapshotSchema,
      confirmedAtMs: z.number(),
    }),
    z.object({
      status: z.literal('failing'),
      snapshot: snapshotSchema,
      confirmedAtMs: z.number(),
      problem: z.string(),
      failedVersion: failedVersionSchema.optional(),
    }),
    z.object({
      status: z.literal('rejected'),
      snapshot: snapshotSchema,
      confirmedAtMs: z.number(),
      problem: z.string(),
      rejectedVersion: z.string().optional(),
      failedVersion: failedVersionSchema.optional(),
    }),
  ]);
