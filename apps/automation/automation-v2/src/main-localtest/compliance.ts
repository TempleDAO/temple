// Local Overlord runner for an end-to-end test of the compliance tasks against
// an anvil fork of Sepolia. Anvil's first account is the Bot
// (`compliance_flagger_signer`); the setup task makes it a Flagger on the
// Sepolia ComplianceCheck by impersonating the ComplianceCheck's executor (the Admin).
//
//   anvil --fork-url $SEPOLIA_RPC_URL
//   yarn dev:local:compliance
//
// Then trigger, in order:
//
//   # Make the Bot a Flagger (idempotent)
//   curl -X POST http://localhost:8111/webhooks/compliance-grant-flagger
//
//   # The production tasks
//   curl -X POST http://localhost:8111/webhooks/compliance-ingest-ofac-sdn
//   curl -X POST http://localhost:8111/webhooks/compliance-ingest-manual
//   curl -X POST http://localhost:8111/webhooks/compliance-flag-sepolia
//   curl -X POST http://localhost:8111/webhooks/compliance-enforce-sepolia
//   curl -X POST http://localhost:8111/webhooks/compliance-flagger-check-sepolia
//
//   # The Admin acting by hand, and mining past the Flagged addresses index's confirmations
//   curl -X POST 'http://localhost:8111/webhooks/compliance-admin-unflag?account=0x…'
//   curl -X POST 'http://localhost:8111/webhooks/compliance-admin-flag?account=0x…'
//   curl -X POST 'http://localhost:8111/webhooks/compliance-mine?blocks=13'
//
// Saved state is one JSON file per KV key in COMPLIANCE_KV_DIR (default
// localtest-kv/compliance), named by the URI-encoded key: Overlord's on-disk
// store refuses `/` and `:`, which the production keys use. It survives
// restarts, so restart the runner to change the variables below; the fork
// keeps its state too. Delete the directory (and restart anvil) to start over.
//
// Env (all optional):
//   ANVIL_URL                    the fork, default http://127.0.0.1:8545
//   COMPLIANCE_KV_DIR            where KV files go
//   COMPLIANCE_MANUAL_SOURCE     compliance_manual_source, JSON address → reason
//   COMPLIANCE_EXEMPTIONS            compliance_exemptions, JSON address → reason
//   COMPLIANCE_DISCORD_WEBHOOK   posts Notices, Findings and task failures;
//                                without it a run that has something to post
//                                logs it, then fails
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createTaskRunnerWithConfig,
  getAllVariableMetadata,
  makeLocalManagerConfig,
  makeManagerConfig,
  makeSignerKind,
  makeTaskRunnerConfig,
  TaskContext,
  taskSuccess,
  WebhookTask,
} from '@mountainpath9/overlord-core';
import { getAccount } from '@mountainpath9/overlord-viem';
import {
  Address,
  createTestClient,
  http,
  isAddress,
  parseEther,
  publicActions,
  walletActions,
} from 'viem';
import { ABI as ComplianceCheckAbi } from '@/abi/IComplianceCheck';
import { ABI as ElevatedAccessAbi } from '@/abi/ITempleElevatedAccess';
import * as vars from '@/config/variables';
import {
  COMPLIANCE_SEPOLIA,
  compliance_exemptions,
  compliance_manual_source,
  complianceTasks,
} from '@/tasks/compliance';
import { taskExceptionHandler } from '@/utils/task-exceptions';

const DEPLOYMENT = COMPLIANCE_SEPOLIA;
const ANVIL_URL = process.env.ANVIL_URL ?? 'http://127.0.0.1:8545';
// Anvil's first default account.
const ANVIL_PRIVATE_KEY_0 =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const KV_DIR = resolve(
  process.env.COMPLIANCE_KV_DIR ?? 'localtest-kv/compliance'
);

type Koa = Parameters<WebhookTask['action']>[1];

function jsonEnv(name: string) {
  const value = process.env[name];
  return value === undefined ? undefined : JSON.parse(value);
}

function taskRunnerConfig() {
  const optional = (name: string, value: unknown) =>
    value === undefined ? {} : { [name]: value };
  return makeTaskRunnerConfig({
    label: 'temple-compliance-local',
    http_port: 8111,
    manager: makeManagerConfig(
      'local',
      makeLocalManagerConfig({
        providers: [{ chain_id: DEPLOYMENT.chain.id, rpc_urls: [ANVIL_URL] }],
        signers: [
          {
            wallet_name: DEPLOYMENT.signerId,
            chain_id: DEPLOYMENT.chain.id,
            kind: makeSignerKind('private_key', ANVIL_PRIVATE_KEY_0),
          },
        ],
        kv_storage_dir: KV_DIR,
        vars: {
          ...optional(
            compliance_manual_source.name(),
            jsonEnv('COMPLIANCE_MANUAL_SOURCE')
          ),
          ...optional(
            compliance_exemptions.name(),
            jsonEnv('COMPLIANCE_EXEMPTIONS')
          ),
          ...optional(
            vars.webhook_url.name(),
            process.env.COMPLIANCE_DISCORD_WEBHOOK
          ),
          ...optional(
            vars.error_webhook_url.name(),
            process.env.COMPLIANCE_DISCORD_WEBHOOK
          ),
        },
      })
    ),
  });
}

/**
 * The task context with each KV key URI-encoded, so the on-disk store
 * accepts it. The file name decodes back to the production key.
 */
function fileSafeKv(ctx: TaskContext): TaskContext {
  return {
    ...ctx,
    kvGet: (key) => ctx.kvGet(encodeURIComponent(key)),
    kvSet: (key, value) => ctx.kvSet(encodeURIComponent(key), value),
    kvClear: (key) => ctx.kvClear(encodeURIComponent(key)),
  };
}

/** The fork as a test client acting as the Bot. */
async function fork(ctx: TaskContext) {
  return createTestClient({
    account: await getAccount(ctx, DEPLOYMENT.signerId),
    chain: DEPLOYMENT.chain,
    mode: 'anvil',
    transport: http(ANVIL_URL),
  })
    .extend(publicActions)
    .extend(walletActions);
}

/** Impersonates the ComplianceCheck's executor (the Admin) on the fork, with gas. */
async function impersonateAdmin(tclient: Awaited<ReturnType<typeof fork>>) {
  const executor = await tclient.readContract({
    abi: ElevatedAccessAbi,
    address: DEPLOYMENT.complianceCheck,
    functionName: 'executor',
  });
  await tclient.impersonateAccount({ address: executor });
  await tclient.setBalance({ address: executor, value: parseEther('100') });
  return executor;
}

async function grantFlaggerTask(ctx: TaskContext) {
  const tclient = await fork(ctx);
  const bot = tclient.account.address;
  const admin = await impersonateAdmin(tclient);
  const hash = await tclient.writeContract({
    account: admin,
    abi: ComplianceCheckAbi,
    address: DEPLOYMENT.complianceCheck,
    functionName: 'setFlagger',
    args: [bot, true],
  });
  await tclient.waitForTransactionReceipt({ hash });
  const isFlagger = await tclient.readContract({
    abi: ComplianceCheckAbi,
    address: DEPLOYMENT.complianceCheck,
    functionName: 'isFlagger',
    args: [bot],
  });
  ctx.logger.info(`Bot ${bot} isFlagger=${isFlagger} (admin ${admin})`);
  return taskSuccess();
}

/** The `account` query parameter, as an address. */
function accountParam(koa: Koa): Address {
  const account = koa.query.account;
  if (typeof account !== 'string' || !isAddress(account))
    throw new Error('Query parameter account must be an address');
  return account;
}

/** The Admin calls setFlagged([account], value) by hand. */
function adminSetFlaggedTask(value: boolean) {
  return async (ctx: TaskContext, koa: Koa) => {
    const account = accountParam(koa);
    const tclient = await fork(ctx);
    const admin = await impersonateAdmin(tclient);
    const hash = await tclient.writeContract({
      account: admin,
      abi: ComplianceCheckAbi,
      address: DEPLOYMENT.complianceCheck,
      functionName: 'setFlagged',
      args: [[account], value],
    });
    await tclient.waitForTransactionReceipt({ hash });
    ctx.logger.info(`Admin set ${account} flagged=${value}: ${hash}`);
    return taskSuccess();
  };
}

/** Mines `blocks` blocks (default: one past the Flagged addresses index's confirmations). */
async function mineTask(ctx: TaskContext, koa: Koa) {
  const param = koa.query.blocks;
  if (
    param !== undefined &&
    (typeof param !== 'string' || !/^\d+$/.test(param))
  )
    throw new Error('Query parameter blocks must be a number');
  const blocks =
    param ?? String(DEPLOYMENT.flaggedAddressesIndex.confirmations + 1n);
  const tclient = await fork(ctx);
  await tclient.mine({ blocks: Number(blocks) });
  ctx.logger.info(
    `Mined ${blocks} blocks, head ${await tclient.getBlockNumber()}`
  );
  return taskSuccess();
}

async function main() {
  mkdirSync(KV_DIR, { recursive: true });
  const runner = createTaskRunnerWithConfig(taskRunnerConfig());

  runner.setTaskExceptionHandler(taskExceptionHandler);
  runner.setConfigVariables(getAllVariableMetadata());

  // The runner exits once it has no periodic tasks to schedule.
  runner.addPeriodicTask({
    id: 'keepalive',
    cronSchedule: '0 * * * *',
    action: async () => taskSuccess(),
  });
  runner.addWebhookTask({
    id: 'compliance-grant-flagger',
    action: grantFlaggerTask,
  });
  runner.addWebhookTask({
    id: 'compliance-admin-flag',
    action: adminSetFlaggedTask(true),
  });
  runner.addWebhookTask({
    id: 'compliance-admin-unflag',
    action: adminSetFlaggedTask(false),
  });
  runner.addWebhookTask({ id: 'compliance-mine', action: mineTask });
  // The production tasks, triggered by webhook instead of a schedule.
  for (const task of complianceTasks([DEPLOYMENT]))
    runner.addWebhookTask({
      id: task.id,
      action: (ctx) => task.action(fileSafeKv(ctx)),
    });

  console.log(`compliance KV: ${KV_DIR}`);
  runner.main();
}

main();
