import type { TaskContext } from '@mountainpath9/overlord-core';
import {
  createTransactionManager,
  getMevProtectedWalletClient,
  getWalletClient,
} from '@mountainpath9/overlord-viem';
import type { Address, Hash, Hex } from 'viem';
import type { ComplianceDeployment } from '../config';

/** Sends `data` to `to` and waits for it to be mined, returning its hash. */
type Send = (to: Address, data: Hex) => Promise<Hash>;

/**
 * Sends from the Deployment's signer through Overlord's transaction
 * manager, on the MEV-protected wallet client when `privateSubmission`. Built
 * when the run starts, so missing submission params fail every run, not
 * only the first that has something to send.
 */
export async function createSender(
  ctx: TaskContext,
  deployment: Pick<
    ComplianceDeployment,
    'chain' | 'signerId' | 'submissionParams'
  >,
  { privateSubmission }: { privateSubmission: boolean }
): Promise<Send> {
  const wclient = await (
    privateSubmission ? getMevProtectedWalletClient : getWalletClient
  )(ctx, deployment.chain, deployment.signerId);
  const tm = await createTransactionManager(
    ctx,
    wclient,
    await deployment.submissionParams(ctx)
  );
  return async (to, data) =>
    (await tm.submitAndWait({ to, data })).transactionHash;
}
