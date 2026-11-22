import type { Json } from '@mountainpath9/overlord-core';
import type { Hash } from 'viem';
import type { Finding } from '../attention';
import type { SourceState } from '../ingest';
import { CuratedList, type LCAddress } from '../shared';
import type { FlaggedAddressesIndexRead } from './flagged-addresses-index';
import { planFlags, TargetSet } from './plan';

/**
 * Everything a flag run touches, as small async functions. The task builds
 * it from Overlord, the KV store and viem; tests build it from plain data.
 */
export interface FlagContext {
  /** The head block. Read once, first: every chain read is at it. */
  readHeadBlock(): Promise<bigint>;
  /**
   * Each of the Deployment's Sources' stored state, as its ingest task last
   * left it (Absent if it never ran). Never the Source itself.
   */
  readSources(): Promise<{ id: string; state: SourceState }[]>;
  /**
   * The raw `compliance_exemptions` value. A value set to anything but a JSON
   * object of address → reason fails the run before any chain read.
   */
  readExemptions(): Promise<Json | undefined>;
  /**
   * Scans `FlaggedSet` logs up to `atBlock` minus the confirmations. If it
   * throws, the run flags as usual with an empty index and raises
   * FlaggedAddressesIndexFailing.
   */
  readFlaggedAddressesIndex(
    atBlock: bigint
  ): Promise<FlaggedAddressesIndexRead>;
  /** Of `addresses`, those `isFlagged` at `atBlock`. */
  readFlags(
    addresses: readonly LCAddress[],
    atBlock: bigint
  ): Promise<ReadonlySet<LCAddress>>;
  /**
   * Sends `setFlagged(batch, true)` and waits for it to be mined. Without
   * the Flagger role it reverts at simulation and throws.
   */
  setFlagged(batch: readonly LCAddress[]): Promise<Hash>;
}

export interface FlagConfig {
  /** Most addresses per `setFlagged`. */
  maxFlagBatch: number;
}

/** Something a human only needs to know about: the Bot flagged a batch. */
export interface FlagNotice {
  kind: 'Flagged';
  addresses: LCAddress[];
  /**
   * The batch's addresses the Flagged addresses index last saw unflagged:
   * someone unflagged a Listed address without exempting it, and the Bot
   * undid it. An unflag within the index's `confirmations` isn't seen yet.
   */
  reflagged: LCAddress[];
  txHash: Hash;
}

export interface FlagRun {
  findings: Finding[];
  /** One per batch mined, including those before a failed one. */
  notices: FlagNotice[];
  /**
   * Whatever a `setFlagged` threw, kept as-is so the task's exception
   * handler reports the original error. Sending stopped there; the caller
   * posts the Notices and then fails the run with it.
   */
  sendFailure?: unknown;
}

/**
 * One flag run for a Deployment: a reconcile of the Target set against
 * what is Flagged. Keeps no record of what it sent: a dropped or failed
 * transaction is simply retried by the next run. Add-only: every call is
 * `setFlagged(batch, true)`.
 */
export async function runFlag(
  ctx: FlagContext,
  config: FlagConfig
): Promise<FlagRun> {
  const exemptions = CuratedList.parse(await ctx.readExemptions());
  // Reading a malformed value as no Exemptions would flag every exempt
  // address, and the Bot never unflags. Fail before any chain read until a
  // human fixes it.
  if (exemptions === 'malformed')
    throw new Error(
      `compliance_exemptions is not ${CuratedList.FORMAT}: no flag run until it is fixed`
    );
  const atBlock = await ctx.readHeadBlock();
  const sources = await ctx.readSources();
  const indexRead = await readIndexOrEmpty(ctx, atBlock);
  const index = indexRead.index;

  const target = TargetSet.from(sources, exemptions);
  const isFlagged = await ctx.readFlags(
    [...new Set([...target.addresses, ...target.exempt, ...index.flagged])],
    atBlock
  );
  const planned = planFlags(target, index, isFlagged);
  const toFlag = planned.toFlag;
  const findings = indexRead.finding
    ? [...planned.findings, indexRead.finding]
    : planned.findings;

  const notices: FlagNotice[] = [];
  for (const batch of chunk(toFlag, config.maxFlagBatch)) {
    let txHash: Hash;
    try {
      txHash = await ctx.setFlagged(batch);
    } catch (e) {
      return { findings, notices, sendFailure: e };
    }
    notices.push({
      kind: 'Flagged',
      addresses: batch,
      reflagged: batch.filter((a) => index.unflagged.has(a)),
      txHash,
    });
  }

  return { findings, notices };
}

/**
 * The index only finds UnbackedFlags and names re-flags, so a failed scan
 * never holds up flagging: it reads as empty and incomplete, and raises
 * FlaggedAddressesIndexFailing instead.
 */
async function readIndexOrEmpty(
  ctx: FlagContext,
  atBlock: bigint
): Promise<{ index: FlaggedAddressesIndexRead; finding?: Finding }> {
  try {
    return { index: await ctx.readFlaggedAddressesIndex(atBlock) };
  } catch (e) {
    return {
      index: { flagged: new Set(), unflagged: new Set(), complete: false },
      finding: {
        kind: 'FlaggedAddressesIndexFailing',
        key: '',
        summary: `Flagged addresses index scan failed: ${String(e).split('\n')[0]}`,
      },
    };
  }
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}
