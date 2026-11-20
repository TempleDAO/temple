import { expect, test } from 'vitest';
import type { Address } from 'viem';
import { sepolia } from 'viem/chains';
import type { ComplianceDeployment } from './config';
import { complianceTasks } from './tasks';

const FACTORY: Address = '0x00000000000000000000000000000000000000fa';

const deployment = (
  depositorIndex?: ComplianceDeployment['depositorIndex'],
  name = 'sepolia',
  complianceCheck: Address = '0x00000000000000000000000000000000000000cc'
): ComplianceDeployment => ({
  name,
  chain: sepolia,
  complianceCheck,
  signerId: 'bot',
  sourceIds: ['manual'],
  privateSubmission: false,
  submissionParams: async () => {
    throw new Error('unused');
  },
  flaggedAddressesIndex: { deployBlock: 1n, confirmations: 12n },
  depositorIndex,
});

const schedules = (d: ComplianceDeployment) =>
  complianceTasks([d]).map(({ id, cronSchedule }) => [id, cronSchedule]);

test('a Deployment without a Depositor index registers no enforce task', () => {
  expect(schedules(deployment())).toEqual([
    ['compliance-ingest-manual', '* * * * *'],
    ['compliance-flag-sepolia', '* * * * *'],
  ]);
});

test('a Deployment with a Depositor index also enforces, every 20 minutes', () => {
  expect(
    schedules(
      deployment({
        subgraphUrl: 'https://subgraph.test',
        factory: FACTORY,
      })
    )
  ).toEqual([
    ['compliance-ingest-manual', '* * * * *'],
    ['compliance-flag-sepolia', '* * * * *'],
    ['compliance-enforce-sepolia', '*/20 * * * *'],
  ]);
});

test('two Deployments may serve two ComplianceChecks on one network, each with its own tasks', () => {
  const index = { subgraphUrl: 'https://subgraph.test', factory: FACTORY };
  const ids = complianceTasks([
    deployment(index),
    deployment(
      index,
      'sepolia-2',
      '0x00000000000000000000000000000000000000c2'
    ),
  ]).map((t) => t.id);
  expect(ids).toEqual([
    'compliance-ingest-manual',
    'compliance-flag-sepolia',
    'compliance-flag-sepolia-2',
    'compliance-enforce-sepolia',
    'compliance-enforce-sepolia-2',
  ]);
});

test('a duplicate name or ComplianceCheck is refused at startup', () => {
  expect(() =>
    complianceTasks([
      deployment(),
      deployment(
        undefined,
        'sepolia',
        '0x00000000000000000000000000000000000000c2'
      ),
    ])
  ).toThrow('share a name');
  expect(() =>
    complianceTasks([deployment(), deployment(undefined, 'sepolia-2')])
  ).toThrow('share a ComplianceCheck on one chain');
});
