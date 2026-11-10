// Local Overlord runner for manually testing Granary notifications against
// the Sepolia subgraph and a real Discord webhook. Unlike mainnet.ts it needs
// no anvil fork. Start with `yarn dev:local:granary`, then trigger:
//
//   # What a production run would announce for changes in blocks (A, B]:
//   # a run whose saved cursor was block A, reading the subgraph at block B.
//   # `from` defaults to just before the first auction or wish, `to` to the
//   # latest indexed block, so a bare call replays everything.
//   curl -X POST 'http://localhost:8111/webhooks/granary-auction-range?from=A&to=B'
//   curl -X POST 'http://localhost:8111/webhooks/granary-wish-range?from=A&to=B'
//
//   # Every announcement type, from fake data:
//   curl -X POST http://localhost:8111/webhooks/granary-fake-auction-states
//   curl -X POST http://localhost:8111/webhooks/granary-fake-wishes
//
//   # The production tasks with in-memory KV: the first call records a silent
//   # baseline, later calls announce what changed since the previous call.
//   curl -X POST http://localhost:8111/webhooks/granary-auction-notifications-sepolia
//   curl -X POST http://localhost:8111/webhooks/granary-wish-notifications-sepolia
//
// Env: GRANARY_NOTIFICATIONS_WEBHOOK_URL and SEPOLIA_RPC_URL (required);
// GRANARY_MOONWATCHER_ROLE_ID and GRANARY_WISHER_ROLE_ID (optional; without
// them messages go out without a mention).
import {
  ConfigVariable,
  TaskContext,
  createTaskRunnerWithConfig,
  getAllVariableMetadata,
  makeLocalManagerConfig,
  makeManagerConfig,
  makeTaskRunnerConfig,
  taskSuccess,
  WebhookTask,
} from '@mountainpath9/overlord-core';
import { getPublicClient } from '@mountainpath9/overlord-viem';
import { collectAuctionAnnouncements } from '@/tasks/granary/auctions';
import { GRANARY_SEPOLIA } from '@/tasks/granary/config';
import { collectWishAnnouncements } from '@/tasks/granary/wishes';
import {
  granaryTasks,
  loadDelivery,
  sendAnnouncements,
} from '@/tasks/granary/tasks';
import type { CursorStep } from '@/tasks/granary/shared';
import {
  Auction,
  createGranarySubgraph,
  GranarySubgraph,
  Snapshot,
  Token,
  Wish,
} from '@/tasks/granary/subgraph';
import { createBaseApi } from '@/utils/api';
import { taskExceptionHandler } from '@/utils/task-exceptions';

// The deployment this runner tests; its chain, contracts and subgraph come
// from the production config.
const DEPLOYMENT = GRANARY_SEPOLIA;
const EXPLORER_URL = DEPLOYMENT.chain.blockExplorers?.default.url;
const AUCTION_URL_TEMPLATE = 'https://example.invalid/auctions/{id}';

// createTaskRunnerWithConfig does not resolve ENV_SECRET: values, so read the
// environment directly.
function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

function optionalVar(name: string, env: string) {
  const value = process.env[env];
  return value ? { [name]: value } : {};
}

// Production always has a provider; viem's default public Sepolia RPC rejects
// unpaid requests, so there is no fallback.
const SEPOLIA_RPC_URL = requireEnv('SEPOLIA_RPC_URL');

function taskRunnerConfig() {
  return makeTaskRunnerConfig({
    label: 'temple-granary-local',
    http_port: 8111,
    manager: makeManagerConfig(
      'local',
      makeLocalManagerConfig({
        providers: [
          { chain_id: DEPLOYMENT.chain.id, rpc_urls: [SEPOLIA_RPC_URL] },
        ],
        vars: {
          [DEPLOYMENT.vars.auctionUrlTemplate.name()]: AUCTION_URL_TEMPLATE,
          [DEPLOYMENT.vars.webhookUrl.name()]: requireEnv(
            'GRANARY_NOTIFICATIONS_WEBHOOK_URL'
          ),
          // Unset roles send without a mention, as in production.
          ...optionalVar(
            DEPLOYMENT.vars.moonwatcherRoleId.name(),
            'GRANARY_MOONWATCHER_ROLE_ID'
          ),
          ...optionalVar(
            DEPLOYMENT.vars.wisherRoleId.name(),
            'GRANARY_WISHER_ROLE_ID'
          ),
        },
      })
    ),
  });
}

// --- Fake data ---------------------------------------------------------------
// Built through the production collectors and Discord delivery, so the posted
// embeds look exactly like real ones. No KV cursor is touched.

// One day between the cursor and the snapshot, ending now, so relative times
// ("3 hours ago") read naturally.
const NOW = Math.floor(Date.now() / 1000);
const CURSOR: Snapshot = { number: 100, timestamp: NOW - 24 * 3600 };
const SNAPSHOT: Snapshot = { number: 200, timestamp: NOW };
/** A time `h` hours after the cursor (negative: before it). */
const at = (h: number) => BigInt(CURSOR.timestamp + h * 3600);
const AFTER_SNAPSHOT = at(48);
const FACTORY = '0x000000000000000000000000000000000000f00d';

const token = (id: string, symbol: string, decimals = 18): Token => ({
  id,
  symbol,
  decimals,
  metadataPending: false,
});
const TGLD = token('0x00000000000000000000000000000000000000a1', 'TGLD');
const USDS = token('0x00000000000000000000000000000000000000a2', 'USDS');
const UNKNOWN = token('0x00000000000000000000000000000000000000a3', '?');
const fakeHash = (n: number) => `0x${n.toString(16).padStart(64, '0')}`;

function auction(
  number: number,
  times: Pick<Auction, 'depositStart' | 'depositEnd' | 'fulfillmentEnd'>,
  overrides: Partial<Auction> = {}
): Auction {
  const address = `0x${number.toString(16).padStart(40, '0')}`;
  return {
    id: `${address}-1`,
    number,
    epoch: 1n,
    fixedPriceAuction: { id: address },
    pair: { bidToken: USDS, fillToken: TGLD },
    ...times,
    outcome: 'None',
    filledBids: 0n,
    totalDeposits: 0n,
    createdAt: at(-30),
    createdHash: fakeHash(number),
    settledAt: 0n,
    cancelledAt: 0n,
    ...overrides,
  };
}

// One auction per distinct announcement. At the cursor, #1 does not exist yet
// and every outcome except #8's is undecided.
const AUCTIONS_NOW: Auction[] = [
  // New since the cursor -> New Moon, with its creation transaction
  auction(
    1,
    {
      depositStart: AFTER_SNAPSHOT,
      depositEnd: AFTER_SNAPSHOT + 1n,
      fulfillmentEnd: AFTER_SNAPSHOT + 2n,
    },
    { createdAt: at(2) }
  ),
  // Scheduled -> Crescent; an unresolved symbol falls back to its address
  auction(
    2,
    {
      depositStart: at(5),
      depositEnd: AFTER_SNAPSHOT,
      fulfillmentEnd: AFTER_SNAPSHOT + 1n,
    },
    { pair: { bidToken: UNKNOWN, fillToken: TGLD } }
  ),
  // Crescent -> Gibbous
  auction(3, {
    depositStart: at(-6),
    depositEnd: at(9),
    fulfillmentEnd: AFTER_SNAPSHOT,
  }),
  // Gibbous -> Full Moon when fulfillment ended (no settlement event)
  auction(
    4,
    { depositStart: at(-9), depositEnd: at(-3), fulfillmentEnd: at(13) },
    { filledBids: 375n, totalDeposits: 1000n }
  ),
  // Gibbous -> Full Moon by a settlement event before fulfillment ended
  auction(
    5,
    {
      depositStart: at(-9),
      depositEnd: at(-3),
      fulfillmentEnd: AFTER_SNAPSHOT,
    },
    {
      outcome: 'Settled',
      settledAt: at(17),
      filledBids: 1000n,
      totalDeposits: 1000n,
    }
  ),
  // Crescent -> Eclipse with nothing deposited
  auction(
    6,
    {
      depositStart: at(-6),
      depositEnd: AFTER_SNAPSHOT,
      fulfillmentEnd: AFTER_SNAPSHOT + 1n,
    },
    { outcome: 'Cancelled', cancelledAt: at(21) }
  ),
  // Unchanged Crescent -> silent
  auction(7, {
    depositStart: at(-6),
    depositEnd: AFTER_SNAPSHOT,
    fulfillmentEnd: AFTER_SNAPSHOT + 1n,
  }),
  // Already terminal at the cursor -> silent
  auction(
    8,
    { depositStart: at(-9), depositEnd: at(-6), fulfillmentEnd: at(-3) },
    { outcome: 'Cancelled', cancelledAt: at(-2) }
  ),
];
const AUCTIONS_AT_CURSOR: Auction[] = AUCTIONS_NOW.filter(
  (a) => a.number !== 1
).map((a) =>
  a.number === 8 ? a : { ...a, outcome: 'None', settledAt: 0n, cancelledAt: 0n }
);

// Open wishes, one with known metadata and one whose bid token metadata is
// pending and cannot be resolved (shown in raw units).
const WISHES: Wish[] = [
  {
    id: '0xw1',
    fromAmount: 250n * 10n ** 18n,
    expiresAt: AFTER_SNAPSHOT,
    setBlock: 150n,
    setAt: at(20),
    setHash: fakeHash(101),
    pair: { bidToken: TGLD, fillToken: USDS },
  },
  {
    id: '0xw2',
    fromAmount: 1234567n,
    expiresAt: AFTER_SNAPSHOT + 7n * 24n * 3600n,
    setBlock: 160n,
    setAt: at(22),
    setHash: fakeHash(102),
    pair: {
      bidToken: { ...UNKNOWN, metadataPending: true, decimals: 0 },
      fillToken: TGLD,
    },
  },
];

const fakeSubgraph: GranarySubgraph = {
  snapshot: async () => SNAPSHOT,
  auctions: async (block) =>
    block.number === SNAPSHOT.number ? AUCTIONS_NOW : AUCTIONS_AT_CURSOR,
  wishes: async () => WISHES,
};

type Koa = Parameters<WebhookTask['action']>[1];

/** Production Discord delivery mentioning `role`; the webhook is always set here. */
async function delivery(ctx: TaskContext, role: ConfigVariable<string>) {
  return (await loadDelivery(ctx, DEPLOYMENT, role))!;
}

/** The announcements of a step that must have advanced. */
function advanced(step: CursorStep<unknown>) {
  if (step.kind !== 'advanced')
    throw new Error(`Expected an advanced step, got ${step.kind}`);
  return step.announcements;
}

/** Posts one embed for every distinct auction announcement. */
async function granaryFakeAuctionStatesTask(ctx: TaskContext) {
  const step = await collectAuctionAnnouncements({
    subgraph: fakeSubgraph,
    factory: FACTORY,
    auctionUrlTemplate:
      await DEPLOYMENT.vars.auctionUrlTemplate.requireValue(ctx),
    explorerUrl: EXPLORER_URL,
    cursor: CURSOR,
  });

  await sendAnnouncements(
    ctx,
    await delivery(ctx, DEPLOYMENT.vars.moonwatcherRoleId),
    advanced(step)
  );
  return taskSuccess();
}

/** Posts the wish embeds for the fake wishes above. */
async function granaryFakeWishesTask(ctx: TaskContext) {
  const step = await collectWishAnnouncements({
    subgraph: fakeSubgraph,
    tokenApi: {
      getToken: async () => {
        throw new Error('Fake token metadata is unavailable');
      },
    },
    explorerUrl: EXPLORER_URL,
    cursor: CURSOR.number,
  });

  await sendAnnouncements(
    ctx,
    await delivery(ctx, DEPLOYMENT.vars.wisherRoleId),
    advanced(step)
  );
  return taskSuccess();
}

// --- Block ranges ------------------------------------------------------------
// Reproduces what a production run would announce for the changes in blocks
// (from, to]: the cursor is block `from` and the subgraph is read at block
// `to`, through the production collectors and Discord delivery. No KV cursor
// is touched.

// Default range starts: one block before the first Granary activity on
// Sepolia, so a call without `from` covers everything indexed.
// First auction instance was created at block 12023503.
const FIRST_AUCTION_BLOCK = 12023503;
// First wish was set at block 12099644.
const FIRST_WISH_BLOCK = 12099644;

/** Parses `?from=A&to=B` and pins a subgraph to block B. */
async function blockRange(ctx: TaskContext, koa: Koa, defaultFrom: number) {
  const block = (name: string) => {
    const value = koa.query[name];
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !/^\d+$/.test(value))
      throw new Error(`Query parameter ${name} must be a block number`);
    return Number(value);
  };
  const from = block('from') ?? defaultFrom;

  const live = createGranarySubgraph(DEPLOYMENT.subgraphUrl);
  const latest = await live.snapshot();
  const toNumber = block('to') ?? latest.number;
  if (toNumber <= from) throw new Error('to must be after from');
  if (toNumber > latest.number)
    throw new Error(
      `The subgraph has only indexed up to block ${latest.number}`
    );

  // The subgraph does not report timestamps for historical blocks.
  const client = await getPublicClient(ctx, DEPLOYMENT.chain);
  const blockSnapshot = async (number: number): Promise<Snapshot> => {
    const { timestamp } = await client.getBlock({
      blockNumber: BigInt(number),
    });
    return { number, timestamp: Number(timestamp) };
  };
  const [cursor, to] = await Promise.all([
    blockSnapshot(from),
    toNumber === latest.number ? latest : blockSnapshot(toNumber),
  ]);
  const subgraph: GranarySubgraph = { ...live, snapshot: async () => to };

  return { cursor, subgraph, client };
}

async function granaryAuctionRangeTask(ctx: TaskContext, koa: Koa) {
  const { cursor, subgraph } = await blockRange(
    ctx,
    koa,
    FIRST_AUCTION_BLOCK - 1
  );
  const step = await collectAuctionAnnouncements({
    subgraph,
    factory: DEPLOYMENT.contracts.FIXED_PRICE_AUCTION_FACTORY.toLowerCase(),
    auctionUrlTemplate:
      await DEPLOYMENT.vars.auctionUrlTemplate.requireValue(ctx),
    explorerUrl: EXPLORER_URL,
    cursor,
  });

  await sendAnnouncements(
    ctx,
    await delivery(ctx, DEPLOYMENT.vars.moonwatcherRoleId),
    advanced(step)
  );
  return taskSuccess();
}

async function granaryWishRangeTask(ctx: TaskContext, koa: Koa) {
  const { cursor, subgraph, client } = await blockRange(
    ctx,
    koa,
    FIRST_WISH_BLOCK - 1
  );
  const step = await collectWishAnnouncements({
    subgraph,
    tokenApi: await createBaseApi(client),
    explorerUrl: EXPLORER_URL,
    cursor: cursor.number,
  });

  await sendAnnouncements(
    ctx,
    await delivery(ctx, DEPLOYMENT.vars.wisherRoleId),
    advanced(step)
  );
  return taskSuccess();
}

async function main() {
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
    id: 'granary-auction-range',
    action: granaryAuctionRangeTask,
  });
  runner.addWebhookTask({
    id: 'granary-wish-range',
    action: granaryWishRangeTask,
  });
  runner.addWebhookTask({
    id: 'granary-fake-auction-states',
    action: granaryFakeAuctionStatesTask,
  });
  runner.addWebhookTask({
    id: 'granary-fake-wishes',
    action: granaryFakeWishesTask,
  });
  // The production tasks, triggered by webhook instead of a schedule.
  for (const task of granaryTasks(DEPLOYMENT)) runner.addWebhookTask(task);

  runner.main();
}

main();
