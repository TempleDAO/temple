import { beforeEach, expect, test, vi } from 'vitest';
import axios from 'axios';
import {
  createConfigAccess,
  Json,
  TaskContext,
} from '@mountainpath9/overlord-core';
import {
  defineGranaryDeployment,
  GranaryDeployment,
  GRANARY_SEPOLIA,
} from './config';
import { mainnet } from 'viem/chains';
import { granaryTasks } from './tasks';

const { postMessage } = vi.hoisted(() => ({ postMessage: vi.fn() }));
vi.mock('axios', () => ({ default: { post: vi.fn() } }));
vi.mock('@/utils/discord', () => ({
  connectDiscord: vi.fn(async () => ({ postMessage })),
}));

const address = '0x2222222222222222222222222222222222222222';
const token = (id: string, symbol: string) => ({
  id,
  symbol,
  decimals: 18,
  metadataPending: false,
});
const bidToken = token('0x3333333333333333333333333333333333333333', 'TGLD');
const fillToken = token('0x4444444444444444444444444444444444444444', 'USDS');
const auction = {
  id: `${address}-1`,
  number: 3,
  epoch: '1',
  fixedPriceAuction: { id: address },
  pair: { bidToken, fillToken },
  depositStart: '900',
  depositEnd: '1100',
  fulfillmentEnd: '1200',
  outcome: 'None',
  filledBids: '42',
  totalDeposits: '100',
  createdAt: '850',
  createdHash: `0x${'ab'.repeat(32)}`,
  settledAt: '0',
  cancelledAt: '0',
};

let block: number;
let timestamp: number;
let auctions: (typeof auction)[];
let auctionSnapshots: Map<number, typeof auctions>;
const wish = {
  id: '0xaaaa',
  fromAmount: '100000000000000000000',
  expiresAt: '2000',
  setBlock: '101',
  setAt: '950',
  setHash: `0x${'cd'.repeat(32)}`,
  pair: { bidToken, fillToken },
};
let wishes: (typeof wish)[];
let state: Map<string, Json>;
let ctx: TaskContext;
let values: Record<string, Json>;

type Embed = { url?: string; fields?: { name: string; value: string }[] };
const embeds = (call: number) =>
  postMessage.mock.calls[call][0].embeds as Embed[];
const allEmbeds = () =>
  postMessage.mock.calls.flatMap(([m]) => m.embeds as Embed[]);

const run = (
  kind: 'auction' | 'wish',
  d: GranaryDeployment = GRANARY_SEPOLIA
) =>
  granaryTasks(d)
    .find((t) => t.id === `granary-${kind}-notifications-${d.network}`)!
    .action(ctx);
const auctionKey = `granary/auctions/11155111/${GRANARY_SEPOLIA.contracts.FIXED_PRICE_AUCTION_FACTORY.toLowerCase()}`;
const wishKey = `granary/wishes/11155111/${GRANARY_SEPOLIA.contracts.WISHING_WELL.toLowerCase()}`;

beforeEach(() => {
  vi.clearAllMocks();
  postMessage.mockReset().mockResolvedValue(undefined);
  block = 100;
  timestamp = 1000;
  auctions = [structuredClone(auction)];
  auctionSnapshots = new Map();
  wishes = [];
  state = new Map();
  values = {
    granary_sepolia_notifications_webhook_url:
      'https://discord.com/api/webhooks/123/test-token',
    granary_sepolia_moonwatcher_role_id: '1234567890123456789',
    granary_sepolia_wisher_role_id: '9876543210987654321',
    granary_sepolia_auction_url_template:
      'https://example.invalid/auctions/{id}',
  };
  ctx = {
    config: createConfigAccess(async (name) => values[name]),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    // Never contacted: these fixtures carry token metadata.
    getProviderUrls: async () => ['http://127.0.0.1:1'],
    kvGet: async (key: string) => structuredClone(state.get(key)),
    kvSet: async (key: string, value: Json) => {
      state.set(key, structuredClone(value));
    },
  } as unknown as TaskContext;
  vi.mocked(axios.post)
    .mockReset()
    .mockImplementation(async (_url, body) => {
      const { query, variables } = body as {
        query: string;
        variables?: { block: number; cursor: string; sinceBlock: string };
      };

      if (query.includes('GranaryMeta')) {
        auctionSnapshots.set(block, structuredClone(auctions));
      }

      const data = query.includes('GranaryMeta')
        ? {
            _meta: {
              deployment: 'test',
              hasIndexingErrors: false,
              block: { number: block, timestamp },
            },
          }
        : query.includes('GranaryWishes')
          ? {
              wishes: wishes
                .filter(
                  (w) =>
                    w.id > (variables?.cursor ?? '') &&
                    BigInt(w.setBlock) > BigInt(variables?.sinceBlock ?? '0') &&
                    BigInt(w.setBlock) <= BigInt(variables!.block)
                )
                .sort((a, b) => a.id.localeCompare(b.id))
                .slice(0, 1000),
            }
          : {
              auctions: auctionSnapshots
                .get(variables!.block)!
                .filter((a) => a.id > (variables?.cursor ?? ''))
                .sort((a, b) => a.id.localeCompare(b.id))
                .slice(0, 1000),
            };
      return { data: { data } };
    });
});

test('rejects an invalid app URL before committing the auction baseline', async () => {
  values.granary_sepolia_auction_url_template = "javascript:alert('{id}')";
  await expect(run('auction')).rejects.toThrow('Invalid Granary auction URL');
  expect(state.size).toBe(0);
  expect(postMessage).not.toHaveBeenCalled();
});

test('never announces a phase moving backwards and still advances the cursor', async () => {
  await run('auction'); // Deposit at 1000
  block = 101;
  timestamp = 1050;
  // Hypothetical: deadlines are fixed at creation, so only a reindex could move them.
  auctions = [
    {
      ...auction,
      depositStart: '1500',
      depositEnd: '1600',
      fulfillmentEnd: '1700',
    },
  ];
  await run('auction');
  expect(postMessage).not.toHaveBeenCalled();
  expect([...state.values()]).toEqual([{ number: 101, timestamp: 1050 }]);
});

test('announces only the current phase after downtime and treats another epoch as a new auction', async () => {
  timestamp = 899;
  await run('auction');
  block++;
  timestamp = 1300;
  await run('auction');
  expect(embeds(0)).toHaveLength(1);
  block++;
  timestamp = 1350;
  auctions.push({
    ...auction,
    id: `${address}-2`,
    epoch: '2',
    number: 4,
    depositStart: '1400',
  });
  await run('auction');
  expect(embeds(1).map((e) => e.url)).toEqual([
    `https://example.invalid/auctions/${address}-2`,
  ]);
  block++;
  timestamp = 1360;
  await run('auction');
  expect(postMessage).toHaveBeenCalledTimes(2);
});

test('orders a run by when each auction entered its current phase', async () => {
  auctions = [];
  await run('auction');
  block++;
  timestamp = 1300;
  // Ids sort in reverse number order, so the subgraph returns #5 before #2.
  const at = (n: number, overrides: Partial<typeof auction>) => ({
    ...auction,
    id: `0x${(10 - n).toString().padStart(40, '0')}-1`,
    number: n,
    ...overrides,
  });
  auctions = [
    at(5, { outcome: 'Cancelled', cancelledAt: '1000' }), // tie: by number
    at(4, { outcome: 'Cancelled' }), // unknown time: sorts as now (1300)
    at(3, { outcome: 'Settled', settledAt: '1150' }),
    at(2, { outcome: 'Cancelled', cancelledAt: '1000' }),
    at(1, {}), // clock settlement at 1200
  ];
  const numberOf = new Map(
    auctions.map((a) => [`https://example.invalid/auctions/${a.id}`, a.number])
  );
  await run('auction');
  expect(embeds(0).map((e) => numberOf.get(e.url!))).toEqual([2, 5, 3, 1, 4]);
});

test('rejects an older auction snapshot and keeps terminal instances silent after recovery', async () => {
  await run('auction');
  block = 101;
  timestamp = 1300;
  await run('auction');
  block = 100;
  timestamp = 1000;
  await expect(run('auction')).rejects.toThrow(
    'Granary subgraph is behind the auction checkpoint'
  );
  block = 102;
  timestamp = 1400;
  await run('auction');
  expect(postMessage).toHaveBeenCalledOnce();
});

test('retries every auction digest chunk after a later send fails and redacts webhook details', async () => {
  auctions = [];
  await run('auction');
  block++;
  timestamp = 1050;
  auctions = Array.from({ length: 20 }, (_, n) => ({
    ...auction,
    id: `${address}-${n + 1}`,
    epoch: `${n + 1}`,
    number: n + 1,
  }));
  postMessage
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('request contained test-token'));
  await expect(run('auction')).rejects.toThrow(
    /^Granary Discord delivery failed$/
  );

  expect([...state.values()]).toEqual([{ number: 100, timestamp: 1000 }]);
  await run('auction');
  expect(postMessage).toHaveBeenCalledTimes(4);
  expect(postMessage.mock.calls[2][0]).toEqual(postMessage.mock.calls[0][0]);

  for (const [message] of postMessage.mock.calls) {
    expect(message.embeds.length).toBeLessThanOrEqual(10);
    expect(message.allowedMentions).toEqual({
      parse: [],
      roles: ['1234567890123456789'],
    });
  }

  const delivered = allEmbeds()
    .slice(20)
    .map((e) => e.url)
    .sort();
  expect(delivered).toEqual(
    Array.from(
      { length: 20 },
      (_, n) => `https://example.invalid/auctions/${address}-${n + 1}`
    ).sort()
  );

  block++;
  timestamp = 1060;
  await run('auction');
  expect(postMessage).toHaveBeenCalledTimes(4);
});

test('reads every auction page before committing a baseline', async () => {
  auctions = Array.from({ length: 1001 }, (_, n) => ({
    ...auction,
    id: `0x${n.toString(16).padStart(40, '0')}-1`,
    number: n + 1,
  }));
  const request = vi.mocked(axios.post).getMockImplementation()!;
  vi.mocked(axios.post).mockImplementation(async (...args) => {
    const { query, variables } = args[1] as {
      query: string;
      variables: { cursor?: string };
    };

    if (query.includes('GranaryAuctions') && variables.cursor)
      throw new Error('Second auction page unavailable');

    return request(...args);
  });
  await expect(run('auction')).rejects.toThrow(
    'Granary subgraph request failed'
  );
  expect(state.size).toBe(0);
  expect(postMessage).not.toHaveBeenCalled();

  vi.mocked(axios.post).mockImplementation(request);
  await run('auction');
  expect([...state.values()]).toEqual([{ number: 100, timestamp: 1000 }]);
  expect(postMessage).not.toHaveBeenCalled();
  block++;
  timestamp = 1100;
  await run('auction');
  expect(postMessage).toHaveBeenCalledTimes(101);
  expect(allEmbeds()).toHaveLength(1001);
});

test.each([
  { fromAmount: '0', expiresAt: '2000' },
  { fromAmount: '100', expiresAt: '1049' },
  { fromAmount: '100', expiresAt: '1050' },
])(
  'does not announce a wish with amount $fromAmount and expiry $expiresAt at 1050',
  async (update) => {
    await run('wish');
    wishes = [{ ...wish, ...update }];
    block = 101;
    timestamp = 1050;
    await run('wish');
    expect(postMessage).not.toHaveBeenCalled();
    block = 102;
    timestamp = 1100;
    await run('wish');
    expect(postMessage).not.toHaveBeenCalled();
  }
);

test('batches latest wishes and retries the whole digest before advancing its cursor', async () => {
  await run('wish');
  wishes = [
    { ...wish, fromAmount: '200000000000000000000' },
    { ...wish, id: '0xbbbb' },
  ];
  block = 101;
  timestamp = 1050;
  postMessage.mockRejectedValueOnce(new Error('unavailable'));
  await expect(run('wish')).rejects.toThrow('Granary Discord delivery failed');
  await run('wish');
  expect(postMessage).toHaveBeenCalledTimes(2);
  for (const [message] of postMessage.mock.calls)
    expect(message.embeds).toHaveLength(2);

  expect([...state.values()]).toEqual([101]);
  block = 102;
  timestamp = 1100;
  await run('wish');
  expect(postMessage).toHaveBeenCalledTimes(2);
});

test('rejects indexing errors without baselining either task', async () => {
  vi.mocked(axios.post).mockResolvedValue({
    data: {
      data: {
        _meta: {
          hasIndexingErrors: true,
          block: { number: 100, timestamp: 1000 },
        },
      },
    },
  });
  const indexingError = /invalid_literal[\s\S]*hasIndexingErrors/;
  await expect(run('auction')).rejects.toThrow(indexingError);
  await expect(run('wish')).rejects.toThrow(indexingError);
  expect(state.size).toBe(0);
  expect(postMessage).not.toHaveBeenCalled();
});

test.each([
  { role: 'unset', value: undefined },
  { role: 'malformed', value: 'moonwatchers' },
])('sends without a mention when the role is $role', async ({ value }) => {
  if (value === undefined) delete values.granary_sepolia_moonwatcher_role_id;
  else values.granary_sepolia_moonwatcher_role_id = value;
  await run('auction');
  block = 101;
  timestamp = 1100;
  await run('auction');

  expect(postMessage).toHaveBeenCalledOnce();
  expect(postMessage.mock.calls[0][0].content).toBeUndefined();
  expect(postMessage.mock.calls[0][0].allowedMentions).toEqual({
    parse: [],
    roles: [],
  });
  expect(embeds(0)).toHaveLength(1);
  expect([...state.values()]).toEqual([{ number: 101, timestamp: 1100 }]);
});

test('runs deployments side by side with separate settings and cursors', async () => {
  const other = defineGranaryDeployment({
    network: 'othernet',
    chain: mainnet,
    subgraphUrl: 'https://example.invalid/othernet',
    contracts: {
      FIXED_PRICE_AUCTION_FACTORY: '0x5555555555555555555555555555555555555555',
      WISHING_WELL: '0x6666666666666666666666666666666666666666',
    },
  });

  // Unconfigured: silent, no requests, no cursor.
  await run('auction', other);
  await run('wish', other);
  expect(axios.post).not.toHaveBeenCalled();
  expect(state.size).toBe(0);

  values.granary_othernet_notifications_webhook_url =
    'https://discord.com/api/webhooks/456/other-token';
  values.granary_othernet_moonwatcher_role_id = '1111111111111111111';
  values.granary_othernet_auction_url_template =
    'https://example.invalid/other/{id}';
  await run('auction');
  await run('auction', other);
  await run('wish');
  expect([...state.keys()].sort()).toEqual([
    'granary/auctions/1/0x5555555555555555555555555555555555555555',
    auctionKey,
    wishKey,
  ]);
  expect(postMessage).not.toHaveBeenCalled();

  block = 101;
  timestamp = 1100;
  await run('auction', other);
  expect(postMessage.mock.calls[0][0].content).toBe('<@&1111111111111111111>');
  expect(embeds(0)[0].url).toMatch(/^https:\/\/example\.invalid\/other\//);
});

test('announces a wish updated after a silent baseline without replaying its block', async () => {
  wishes = [{ ...wish, setBlock: '100', setAt: '1000' }];
  await run('wish');
  expect(postMessage).not.toHaveBeenCalled();
  block = 101;
  timestamp = 1050;
  await run('wish');
  expect(postMessage).not.toHaveBeenCalled();
  block = 102;
  timestamp = 1100;
  wishes = [{ ...wish, setBlock: '102', setAt: '1100' }];
  await run('wish');
  expect(postMessage).toHaveBeenCalledOnce();
  expect(postMessage.mock.calls[0][0]).toMatchObject({
    content: '<@&9876543210987654321>',
    allowedMentions: { parse: [], roles: ['9876543210987654321'] },
  });
  expect(embeds(0)).toHaveLength(1);
});

test('baselines auctions silently and announces a clock transition once across restarts', async () => {
  await run('auction');
  expect(postMessage).not.toHaveBeenCalled();
  block = 101;
  timestamp = 1100;
  await run('auction');
  expect(postMessage).toHaveBeenCalledOnce();
  expect(postMessage.mock.calls[0][0]).toMatchObject({
    content: '<@&1234567890123456789>',
    allowedMentions: { parse: [], roles: ['1234567890123456789'] },
  });
  expect(embeds(0).map((e) => e.url)).toEqual([
    `https://example.invalid/auctions/${address}-1`,
  ]);
  block = 102;
  timestamp = 1150;
  await run('auction');
  expect(postMessage).toHaveBeenCalledOnce();
});

test('announces outcomes decided since the cursor in one message and saves the snapshot as the cursor', async () => {
  auctions.push({ ...auction, id: `${address}-2`, epoch: '2', number: 4 });
  await run('auction');

  block = 101;
  timestamp = 1050;
  auctions[0].outcome = 'Cancelled';
  auctions[1].outcome = 'Settled';
  await run('auction');

  expect(postMessage).toHaveBeenCalledOnce();
  expect(embeds(0).map((e) => e.url)).toEqual([
    `https://example.invalid/auctions/${address}-1`,
    `https://example.invalid/auctions/${address}-2`,
  ]);
  expect([...state.values()]).toEqual([{ number: 101, timestamp: 1050 }]);

  block = 102;
  timestamp = 1060;
  await run('auction');
  expect(postMessage).toHaveBeenCalledOnce();
});

test('keeps the auction cursor when the previous indexed snapshot is unavailable', async () => {
  await run('auction');
  block = 101;
  timestamp = 1100;

  const request = vi.mocked(axios.post).getMockImplementation()!;
  vi.mocked(axios.post).mockImplementation(async (...args) => {
    const { query, variables } = args[1] as {
      query: string;
      variables: { block?: number };
    };

    if (query.includes('GranaryAuctions') && variables.block === 100)
      throw new Error('Historical data unavailable');

    return request(...args);
  });

  await expect(run('auction')).rejects.toThrow(
    'Granary subgraph request failed'
  );
  expect(postMessage).not.toHaveBeenCalled();
  expect([...state.values()]).toEqual([{ number: 100, timestamp: 1000 }]);

  vi.mocked(axios.post).mockImplementation(request);
  await run('auction');
  expect(embeds(0)).toHaveLength(1);
});

test('includes all wishes from the same block across pages before advancing the cursor', async () => {
  await run('wish');
  block = 101;
  timestamp = 1050;
  wishes = Array.from({ length: 1001 }, (_, n) => ({
    ...wish,
    id: `0x${n.toString(16).padStart(40, '0')}`,
  }));

  await run('wish');
  expect(postMessage).toHaveBeenCalledTimes(101);
  expect(allEmbeds()).toHaveLength(1001);
  expect([...state.values()]).toEqual([101]);

  const delivered = postMessage.mock.calls.length;
  block = 102;
  timestamp = 1100;
  await run('wish');
  expect(postMessage).toHaveBeenCalledTimes(delivered);
});

test.each([
  { filledBids: '99996', totalDeposits: '100000', fill: '100.00%' },
  { filledBids: '9996', totalDeposits: '1000000', fill: '1.00%' },
  { filledBids: '375', totalDeposits: '1000', fill: '37.50%' },
])(
  'rounds a fill of $filledBids / $totalDeposits to $fill',
  async ({ filledBids, totalDeposits, fill }) => {
    timestamp = 1150;
    await run('auction');
    block = 101;
    timestamp = 1250;
    auctions = [{ ...auction, filledBids, totalDeposits }];
    await run('auction');
    expect(embeds(0)[0].fields!.find((f) => f.name === 'Fill')!.value).toBe(
      fill
    );
  }
);

test('settles at fulfillmentEnd while the outcome stays None, as the contract leaves it', async () => {
  timestamp = 1150;
  await run('auction'); // Fulfillment
  block = 101;
  timestamp = 1300;
  // A claim after the deadline emitted AuctionSettled with settledAt = fulfillmentEnd.
  auctions = [{ ...auction, settledAt: '1200' }];
  await run('auction');
  expect(allEmbeds()).toHaveLength(1);
  expect(embeds(0)[0].fields!.map((f) => f.name)).toContain('Fill');
});

// The fixture's deadlines: Scheduled before 900, Deposit until 1100,
// Fulfillment until 1200, Settlement after.
test.each([
  { edge: 'Scheduled -> Deposit', from: [850], to: [950], sent: 1 },
  { edge: 'Scheduled -> Fulfillment', from: [850], to: [1150], sent: 1 },
  {
    edge: 'Scheduled -> Cancelled',
    from: [850],
    to: [870, 'Cancelled'],
    sent: 1,
  },
  { edge: 'Deposit -> Fulfillment', from: [950], to: [1150], sent: 1 },
  { edge: 'Fulfillment -> Settlement', from: [1150], to: [1250], sent: 1 },
  {
    edge: 'Fulfillment -> Cancelled',
    from: [1150],
    to: [1160, 'Cancelled'],
    sent: 1,
  },
  {
    edge: 'Settlement -> Cancelled',
    from: [1250],
    to: [1260, 'Cancelled'],
    sent: 0,
  },
  {
    edge: 'Cancelled -> Settlement',
    from: [1150, 'Cancelled'],
    to: [1250],
    sent: 0,
  },
  { edge: 'Deposit -> Deposit', from: [950], to: [1000], sent: 0 },
] as { edge: string; from: Moment; to: Moment; sent: number }[])(
  'announces $edge with $sent embeds',
  async ({ from, to, sent }) => {
    const at = ([time, outcome = 'None']: Moment) => {
      timestamp = time;
      auctions = [{ ...auction, outcome }];
    };
    at(from);
    await run('auction');
    block = 101;
    at(to);
    await run('auction');
    expect(allEmbeds()).toHaveLength(sent);
  }
);
type Moment = [number, ('None' | 'Cancelled')?];

test('rejects a wish snapshot behind the cursor and keeps the cursor', async () => {
  state.set(wishKey, 105);
  await expect(run('wish')).rejects.toThrow('behind the wish checkpoint');
  expect(state.get(wishKey)).toBe(105);
});

test('rejects an auction snapshot with a later block but an earlier time', async () => {
  await run('auction');
  block = 101;
  timestamp = 999;
  await expect(run('auction')).rejects.toThrow('behind the auction checkpoint');
  expect(state.get(auctionKey)).toEqual({ number: 100, timestamp: 1000 });
});
