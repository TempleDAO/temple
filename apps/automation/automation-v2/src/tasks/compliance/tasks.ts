import type { TaskContext, TaskResult } from '@mountainpath9/overlord-core';
import type { ComplianceDeployment, EnforcingDeployment } from './config';
import { enforceTask } from './enforce';
import { flagTask } from './flag';
import { flaggerCheckTask } from './flagger-check';
import { ingestTask, SOURCES } from './ingest';
import { chainAddressKey, lcAddress } from './shared';

/**
 * Every compliance task with its schedule: one ingest task per Source some
 * Deployment uses and one flag task per Deployment, every minute; plus one
 * enforce task every 20 minutes per Deployment with a Depositor index; and
 * one flagger-check task per Deployment, daily.
 * Overlord skips a run while the previous run of the same task is still
 * going.
 *
 * Throws on two Deployments with the same name, or the same ComplianceCheck
 * on the same chain: either would make two tasks fight over one identity.
 */
export function complianceTasks(deployments: readonly ComplianceDeployment[]): {
  id: string;
  cronSchedule: string;
  action: (ctx: TaskContext) => Promise<TaskResult>;
}[] {
  assertDistinct(deployments, (deployment) => deployment.name, 'name');
  assertDistinct(
    deployments,
    (deployment) =>
      chainAddressKey(deployment.chain.id, deployment.complianceCheck),
    'ComplianceCheck on one chain'
  );

  const usedSourceIds = new Set(
    deployments.flatMap((deployment) => deployment.sourceIds)
  );
  const enforcing = deployments.filter(enforces).map((deployment) => ({
    deployment,
    factoryKey: chainAddressKey(
      deployment.chain.id,
      deployment.depositorIndex.factory
    ),
  }));
  return [
    ...[...usedSourceIds].map((id) => ({
      ...ingestTask(SOURCES[id]),
      cronSchedule: EVERY_MINUTE,
    })),
    ...deployments.map((deployment) => ({
      ...flagTask(deployment),
      cronSchedule: EVERY_MINUTE,
    })),
    ...enforcing.map(({ deployment, factoryKey }) => {
      const sameFactory = enforcing.filter((e) => e.factoryKey === factoryKey);
      // The first Deployment per factory reports AuctionComplianceCheckUnserved.
      const enforcedComplianceChecks =
        sameFactory[0].deployment === deployment
          ? new Set(
              sameFactory.map((e) => lcAddress(e.deployment.complianceCheck))
            )
          : undefined;
      return {
        ...enforceTask(deployment, enforcedComplianceChecks),
        cronSchedule: EVERY_20_MINUTES,
      };
    }),
    ...deployments.map((deployment) => ({
      ...flaggerCheckTask(deployment),
      cronSchedule: DAILY,
    })),
  ];
}

const EVERY_MINUTE = '* * * * *';
const EVERY_20_MINUTES = '*/20 * * * *';
const DAILY = '0 9 * * *';

function enforces(
  deployment: ComplianceDeployment
): deployment is EnforcingDeployment {
  return deployment.depositorIndex !== undefined;
}

function assertDistinct<T>(
  items: readonly T[],
  key: (item: T) => string,
  what: string
): void {
  const seen = new Set<string>();
  for (const item of items) {
    const k = key(item);
    if (seen.has(k))
      throw new Error(`Two compliance Deployments share a ${what}: ${k}`);
    seen.add(k);
  }
}
