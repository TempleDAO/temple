import type { TaskContext } from '@mountainpath9/overlord-core';
import { getPublicClient } from '@mountainpath9/overlord-viem';
import { encodeFunctionData, type Hex } from 'viem';
import { ABI as ComplianceCheckAbi } from '@/abi/IComplianceCheck';
import { assertNever } from '@/tlc/assert-never';
import { runTask } from '../attention';
import type { ComplianceDeployment } from '../config';
import { explorerTxUrl } from '@/tasks/granary/shared';
import { readSourceState, SourceState } from '../ingest';
import {
  createSender,
  type LCAddress,
  listUpTo,
  readIsFlagged,
} from '../shared';
import {
  compliance_exempt_legacy,
  compliance_exemptions,
  compliance_max_flag_batch,
} from '../variables';
import { scanFlaggedAddressesIndex } from './flagged-addresses-index';
import {
  FLAGGED_ADDRESSES_INDEX_SCAN,
  productionFlaggedAddressesIndexContext,
} from './flagged-addresses-index-store';
import { chooseExemptions } from './plan';
import { FlagContext, FlagNotice, runFlag } from './run';

/**
 * Each run builds the production context, calls `runFlag`, and hands its
 * Findings and Notices to attention.
 */
export function flagTask(deployment: ComplianceDeployment) {
  return {
    id: `compliance-flag-${deployment.name}`,
    action: (ctx: TaskContext) =>
      runTask(
        ctx,
        `flag:${deployment.name}`,
        async () =>
          runFlag(await productionFlagContext(ctx, deployment), {
            maxFlagBatch: await compliance_max_flag_batch.requireValue(ctx),
          }),
        (n) => noticeText(deployment, n)
      ),
  };
}

/** The production FlagContext: Overlord's KV and variables, and viem at the Deployment's chain. */
async function productionFlagContext(
  ctx: TaskContext,
  deployment: ComplianceDeployment
): Promise<FlagContext> {
  const pclient = await getPublicClient(ctx, deployment.chain);
  const send = await createSender(ctx, deployment, {
    privateSubmission: deployment.privateSubmission,
  });

  return {
    readHeadBlock: () => pclient.getBlockNumber(),
    readSources: () =>
      Promise.all(
        deployment.sourceIds.map(async (id) => ({
          id,
          state:
            (await readSourceState(ctx, id)) ?? SourceState.initial(Date.now()),
        }))
      ),
    readExemptions: async () =>
      chooseExemptions(
        await compliance_exemptions.getValue(ctx),
        await compliance_exempt_legacy.getValue(ctx)
      ),
    readFlaggedAddressesIndex: async (atBlock) => {
      const index = await scanFlaggedAddressesIndex(
        productionFlaggedAddressesIndexContext(ctx, deployment, pclient),
        {
          ...deployment.flaggedAddressesIndex,
          ...FLAGGED_ADDRESSES_INDEX_SCAN,
        },
        atBlock
      ).catch((e: unknown) => {
        // runFlag carries on without the index; keep the full error here.
        ctx.logger.warn(
          `flag:${deployment.name} Flagged addresses index scan failed: ${String(e)}`
        );
        throw e;
      });
      if (!index.complete)
        ctx.logger.info(
          `flag:${deployment.name} Flagged addresses index backfill continues next run`
        );
      return index;
    },
    readFlags: (addresses, atBlock) =>
      readIsFlagged(pclient, deployment.complianceCheck, addresses, atBlock),
    setFlagged: (batch) =>
      send(deployment.complianceCheck, setFlaggedData(batch)),
  };
}

/** Calldata for `setFlagged(batch, true)`. Add-only: the Bot never unflags. */
export function setFlaggedData(batch: readonly LCAddress[]): Hex {
  return encodeFunctionData({
    abi: ComplianceCheckAbi,
    functionName: 'setFlagged',
    args: [batch, true],
  });
}

function noticeText(deployment: ComplianceDeployment, n: FlagNotice): string {
  switch (n.kind) {
    case 'Flagged':
      return (
        `flagged ${n.addresses.length} on ${deployment.name}: ${explorerTxUrl(deployment.chain.blockExplorers?.default.url, n.txHash) ?? n.txHash}` +
        (n.reflagged.length
          ? `\nflagged again after an unflag: ${listUpTo(n.reflagged, NOTICE_LIST_MAX)}. To unflag a Listed address for good, add it to compliance_exemptions first.`
          : '')
      );
    default:
      return assertNever(n.kind);
  }
}

const NOTICE_LIST_MAX = 10;
