import type { TaskContext } from '@mountainpath9/overlord-core';
import { getAccount, getPublicClient } from '@mountainpath9/overlord-viem';
import { ABI as ComplianceCheckAbi } from '@/abi/IComplianceCheck';
import { assertNever } from '@/tlc/assert-never';
import { runTask } from '../attention';
import type { ComplianceDeployment } from '../config';
import { lcAddress } from '../shared';
import { FlaggerCheckContext, runFlaggerCheck } from './run';

/**
 * Each run builds the production context, calls `runFlaggerCheck`, and
 * hands its Findings to attention.
 */
export function flaggerCheckTask(deployment: ComplianceDeployment) {
  return {
    id: `compliance-flagger-check-${deployment.name}`,
    action: (ctx: TaskContext) =>
      runTask(
        ctx,
        `flagger-check:${deployment.name}`,
        async () =>
          runFlaggerCheck(
            await productionFlaggerCheckContext(ctx, deployment),
            {
              complianceCheck: lcAddress(deployment.complianceCheck),
              chainName: deployment.chain.name,
            }
          ),
        (n) => assertNever(n)
      ),
  };
}

/** The production FlaggerCheckContext: the signer's address and `isFlagger` at head. */
async function productionFlaggerCheckContext(
  ctx: TaskContext,
  deployment: ComplianceDeployment
): Promise<FlaggerCheckContext> {
  const pclient = await getPublicClient(ctx, deployment.chain);
  return {
    readBotAddress: async () =>
      lcAddress((await getAccount(ctx, deployment.signerId)).address),
    isFlagger: (bot) =>
      pclient.readContract({
        address: deployment.complianceCheck,
        abi: ComplianceCheckAbi,
        functionName: 'isFlagger',
        args: [bot],
      }),
  };
}
