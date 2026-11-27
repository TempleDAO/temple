import type { LCAddress } from '../shared';

/** A Deployment's Flagged addresses, as the index has them. */
export interface FlaggedAddressesIndexRead {
  flagged: ReadonlySet<LCAddress>;
  /**
   * Accounts whose last `FlaggedSet` was an unflag. The Bot never unflags,
   * so someone else did: the Admin, or another Flagger.
   */
  unflagged: ReadonlySet<LCAddress>;
  /**
   * False while a backfill continues next run: the index may miss flags
   * until then. Nothing needs it to be complete, since every candidate is
   * re-checked with `isFlagged`.
   */
  complete: boolean;
}

/** One `FlaggedSet(account, flagged)` log. */
export interface FlaggedSetLog {
  account: LCAddress;
  flagged: boolean;
  blockNumber: bigint;
  logIndex: number;
}

/**
 * The Flagged addresses index as kept in KV: the flagged and unflagged sets
 * after every log up to its Watermark.
 */
export interface FlaggedAddressesIndexState {
  watermark: bigint;
  flagged: readonly LCAddress[];
  unflagged: readonly LCAddress[];
}

/**
 * Everything a scan touches. The flag task builds it from viem and Overlord
 * KV; tests build it from plain data.
 */
export interface FlaggedAddressesIndexContext {
  readState(): Promise<FlaggedAddressesIndexState | undefined>;
  writeState(state: FlaggedAddressesIndexState): Promise<void>;
  /** The `FlaggedSet` logs of the Deployment's ComplianceCheck in [from, to]. */
  getLogs(
    fromBlock: bigint,
    toBlock: bigint
  ): Promise<readonly FlaggedSetLog[]>;
}

export interface FlaggedAddressesIndexConfig {
  /** The ComplianceCheck's deploy block. A scan with no saved state starts here. */
  deployBlock: bigint;
  /**
   * The scan stops this many blocks behind head, so a reorg can't drop a
   * `FlaggedSet` it has already applied. The index is that far behind by
   * design; the flag run re-checks every candidate with `isFlagged`.
   */
  confirmations: bigint;
  /** Most blocks per `eth_getLogs`. Providers cap the range. */
  chunkBlocks: bigint;
  /**
   * Most chunks per run. A long backfill continues next run instead of
   * holding up flagging; meanwhile the read is not `complete`.
   */
  maxChunksPerRun: number;
}

/**
 * The Flagged addresses index: a local copy of the ComplianceCheck's Flagged
 * set. The contract can't enumerate it, so the Bot rebuilds it by scanning
 * the ComplianceCheck's `FlaggedSet` logs from the deploy block and saving
 * the set with the block it's complete to (the Watermark) in KV. Each run
 * continues from there, in chunks, and saves after each one, so the set
 * and its Watermark never disagree.
 *
 * It is used only to find flags no Source backs and to name re-flags. The
 * flag run re-checks every candidate with `isFlagged`, so a behind or wrong
 * index delays or misses a Finding but never causes a false one, and never
 * affects transactions.
 */
export async function scanFlaggedAddressesIndex(
  ctx: FlaggedAddressesIndexContext,
  config: FlaggedAddressesIndexConfig,
  headBlock: bigint
): Promise<FlaggedAddressesIndexRead> {
  let state: FlaggedAddressesIndexState = (await ctx.readState()) ?? {
    watermark: config.deployBlock - 1n,
    flagged: [],
    unflagged: [],
  };
  const confirmedHead = headBlock - config.confirmations;

  for (
    let chunks = 0;
    chunks < config.maxChunksPerRun && state.watermark < confirmedHead;
    chunks++
  ) {
    const from = state.watermark + 1n;
    const to = min(from + config.chunkBlocks - 1n, confirmedHead);
    state = applyFlaggedSetLogs(state, await ctx.getLogs(from, to), to);
    await ctx.writeState(state);
  }

  return {
    flagged: new Set(state.flagged),
    unflagged: new Set(state.unflagged),
    complete: state.watermark >= confirmedHead,
  };
}

/** Applies logs in chain order: the last `FlaggedSet` of an account wins. */
function applyFlaggedSetLogs(
  state: FlaggedAddressesIndexState,
  logs: readonly FlaggedSetLog[],
  watermark: bigint
): FlaggedAddressesIndexState {
  const flagged = new Set(state.flagged);
  const unflagged = new Set(state.unflagged);
  const ordered = [...logs].sort((a, b) =>
    a.blockNumber === b.blockNumber
      ? a.logIndex - b.logIndex
      : a.blockNumber < b.blockNumber
        ? -1
        : 1
  );
  for (const { account, flagged: isFlagged } of ordered) {
    if (isFlagged) {
      flagged.add(account);
      unflagged.delete(account);
    } else {
      flagged.delete(account);
      unflagged.add(account);
    }
  }
  return {
    watermark,
    flagged: [...flagged].sort(),
    unflagged: [...unflagged].sort(),
  };
}

const min = (a: bigint, b: bigint) => (a < b ? a : b);
