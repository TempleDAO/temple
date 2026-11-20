import { TaskContext } from '@mountainpath9/overlord-core';
import { getAbiItem } from 'viem';
import { z } from 'zod';
import { ABI as ComplianceCheckAbi } from '@/abi/IComplianceCheck';
import { uintSchema } from '@/tasks/granary/subgraph';
import type { ComplianceDeployment } from '../config';
import {
  chainAddressKey,
  lcAddress,
  lcAddressSchema,
  type PublicClient,
} from '../shared';
import type {
  FlaggedAddressesIndexContext,
  FlaggedAddressesIndexState,
} from './flagged-addresses-index';

/**
 * 1,000 blocks per `eth_getLogs`, within every common provider's range cap.
 * A backfill does at most 100 per run (100,000 blocks, about two weeks of
 * mainnet) and continues next run.
 */
export const FLAGGED_ADDRESSES_INDEX_SCAN = {
  chunkBlocks: 1_000n,
  maxChunksPerRun: 100,
};

/**
 * The production FlaggedAddressesIndexContext: the index kept in Overlord
 * KV, and `eth_getLogs` at `deployment.chain`.
 */
export function productionFlaggedAddressesIndexContext(
  ctx: TaskContext,
  deployment: ComplianceDeployment,
  pclient: PublicClient
): FlaggedAddressesIndexContext {
  return {
    readState: async () => {
      const saved = await ctx.kvGet(indexKey(deployment));
      return saved === undefined ? undefined : stateSchema.parse(saved);
    },
    writeState: (state: FlaggedAddressesIndexState) =>
      ctx.kvSet(indexKey(deployment), {
        watermark: state.watermark.toString(),
        flagged: [...state.flagged],
        unflagged: [...state.unflagged],
      }),
    // KNOWN LIMIT (SPEC § Flagged addresses index): this request may reach a
    // different node than the head read (fallback transport, load-balanced
    // providers). A node more than `confirmations` behind that clamps
    // `toBlock` returns [] for blocks it hasn't seen, and the scan still
    // advances the Watermark past them, so those logs are lost for good.
    getLogs: async (fromBlock, toBlock) => {
      const logs = await pclient.getLogs({
        address: deployment.complianceCheck,
        event: FLAGGED_SET,
        fromBlock,
        toBlock,
        strict: true,
      });
      return logs.map((l) => ({
        account: lcAddress(l.args.account),
        flagged: l.args.flagged,
        blockNumber: l.blockNumber,
        logIndex: l.logIndex,
      }));
    },
  };
}

/** The index's KV key: per chain and ComplianceCheck, so renaming a Deployment keeps it. */
const indexKey = (deployment: ComplianceDeployment) =>
  `compliance/flagged-addresses-index/${chainAddressKey(deployment.chain.id, deployment.complianceCheck)}`;

const FLAGGED_SET = getAbiItem({ abi: ComplianceCheckAbi, name: 'FlaggedSet' });

const stateSchema = z.object({
  watermark: uintSchema,
  flagged: z.array(lcAddressSchema),
  unflagged: z.array(lcAddressSchema),
});
