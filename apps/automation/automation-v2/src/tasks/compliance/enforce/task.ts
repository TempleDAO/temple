import type { TaskContext } from '@mountainpath9/overlord-core';
import {
  decodeViemError,
  getPublicClient,
  isViemError,
} from '@mountainpath9/overlord-viem';
import { decodeErrorResult, encodeFunctionData, Hex } from 'viem';
import { ABI as CommonEventsAndErrorsAbi } from '@/abi/CommonEventsAndErrors';
import { ABI as FixedPriceAuctionAbi } from '@/abi/IFixedPriceAuction';
import { assertNever } from '@/tlc/assert-never';
import { runTask } from '../attention';
import { compliance_max_depositor_index_lag_blocks } from '../variables';
import type { EnforcingDeployment } from '../config';
import { explorerTxUrl } from '@/tasks/granary/shared';
import { createSender, type LCAddress, readIsFlagged } from '../shared';
import { readDepositorIndex } from './depositor-index';
import type { SettleEarlyBlocker, SettleEarlyCheck } from './plan';
import {
  EnforceContext,
  EnforceNotice,
  ExcludeReverted,
  runEnforce,
} from './run';

/**
 * Each run builds the production context, calls runEnforce, logs every
 * attempt, and hands its Findings and Notices to attention.
 */
export function enforceTask(
  deployment: EnforcingDeployment,
  enforcedComplianceChecks: ReadonlySet<LCAddress> | undefined
) {
  return {
    id: `compliance-enforce-${deployment.name}`,
    action: (ctx: TaskContext) =>
      runTask(
        ctx,
        `enforce:${deployment.name}`,
        async () => {
          const maxLagBlocks =
            await compliance_max_depositor_index_lag_blocks.requireValue(ctx);
          if (!Number.isSafeInteger(maxLagBlocks))
            throw new Error(
              `compliance_max_depositor_index_lag_blocks must be a whole number of blocks, not ${maxLagBlocks}`
            );
          const run = await runEnforce(
            await productionEnforceContext(ctx, deployment),
            {
              maxDepositorIndexLagBlocks: BigInt(maxLagBlocks),
              enforcedComplianceChecks,
            }
          );
          // Skipped attempts post nothing; the log keeps every attempt.
          for (const a of run.attempts)
            ctx.logger.info(
              `enforce:${deployment.name} exclude ${a.account} on ${a.auction} (${a.phase}): ${JSON.stringify(a)}`
            );
          // The Admin reads the latest of these before a settleEarly.
          for (const c of run.settleEarly)
            ctx.logger.info(settleEarlyLine(deployment, c));
          return run;
        },
        (n) => noticeText(deployment, n)
      ),
  };
}

/** Revert data from `exclude`, decoded into its error name, or kept raw if unknown. */
export function decodeExcludeRevert(data: Hex): ExcludeReverted {
  try {
    const decoded = decodeErrorResult({ abi: EXCLUDE_ERRORS_ABI, data });
    return new ExcludeReverted(decoded.errorName);
  } catch {
    return new ExcludeReverted(data);
  }
}

/**
 * The production EnforceContext: the Granary subgraph, `isFlagged` on the
 * Deployment's ComplianceCheck, and `exclude` through Overlord's
 * transaction manager on the public wallet client (a Flagged account can't
 * call the Auction, so there is nothing to front-run).
 */
async function productionEnforceContext(
  ctx: TaskContext,
  deployment: EnforcingDeployment
): Promise<EnforceContext> {
  const pclient = await getPublicClient(ctx, deployment.chain);
  const send = await createSender(ctx, deployment, {
    privateSubmission: false,
  });
  const nowSecs = () => Math.floor(Date.now() / 1000);

  return {
    readHeadBlock: () => pclient.getBlockNumber(),

    readDepositors: () =>
      readDepositorIndex(
        deployment.depositorIndex,
        deployment.complianceCheck,
        nowSecs()
      ),

    readFlags: (accounts, atBlock) =>
      readIsFlagged(pclient, deployment.complianceCheck, accounts, atBlock),

    exclude: async (auction, account) => {
      try {
        return await send(
          auction.address,
          encodeFunctionData({
            abi: FixedPriceAuctionAbi,
            functionName: 'exclude',
            args: [account],
          })
        );
      } catch (e) {
        throw asExcludeReverted(e) ?? e;
      }
    },

    nowSecs,
  };
}

/**
 * A revert before sending (gas estimation), decoded into the Auction's
 * named error. Mined reverts and timeouts are Overlord task errors, not
 * viem errors, and pass through unchanged.
 */
function asExcludeReverted(e: unknown): ExcludeReverted | undefined {
  if (!isViemError(e)) return undefined;
  const viemError = decodeViemError(e);
  if (viemError.kind !== 'reverted') return undefined;
  return decodeExcludeRevert(viemError.data ?? '0x');
}

/**
 * One line per Auction in Fulfillment, found by searching the enforce logs
 * for `settleEarly <auction>`: README.md § Before settleEarly.
 */
function settleEarlyLine(
  deployment: EnforcingDeployment,
  c: SettleEarlyCheck
): string {
  const head = `enforce:${deployment.name} settleEarly ${c.auction}`;
  const blocks = `(flags at block ${c.atBlock}, Depositors indexed to block ${c.watermark})`;
  if (!c.blockers.length)
    return `${head}: safe as of block ${c.atBlock} ${blocks}: every Depositor indexed, none Flagged with a deposit`;
  return `${head}: NOT safe as of block ${c.atBlock} ${blocks}: ${c.blockers.map(blockerText).join('; ')}`;
}

function blockerText(b: SettleEarlyBlocker): string {
  switch (b.kind) {
    case 'depositorIndexBeforeDepositEnd':
      return `the Depositor index is at ${iso(b.watermarkTimestamp)}, before depositEnd ${iso(b.depositEnd)}, so a deposit may be missing`;
    case 'flaggedDepositors':
      return `${b.accounts.length} Flagged Depositor(s) still to exclude: ${b.accounts.join(', ')}`;
    default:
      return assertNever(b);
  }
}

const iso = (secs: bigint) => new Date(Number(secs) * 1000).toISOString();

function noticeText(deployment: EnforcingDeployment, n: EnforceNotice): string {
  switch (n.kind) {
    case 'Excluded':
      return `excluded ${n.account} from Auction ${n.auction} (${n.phase}) on ${deployment.name}: ${explorerTxUrl(deployment.chain.blockExplorers?.default.url, n.txHash) ?? n.txHash}`;
    default:
      return assertNever(n.kind);
  }
}

/**
 * Every error `exclude` can revert with: the interface's own, plus the
 * CommonEventsAndErrors library errors the implementation also throws
 * (`InvalidAccess`, `ExpectedNonZero`), which an interface ABI never
 * includes. Both files are generated by `yarn install-abis`.
 */
const EXCLUDE_ERRORS_ABI = [
  ...FixedPriceAuctionAbi,
  ...CommonEventsAndErrorsAbi,
] as const;
