import type { Auction, Pair, Position, Token, Wish } from './types';

// All dummy data for the prototype: the storyboard's example wallet (0x7a…41c2) and clock.
const d = (s: string) => new Date(`2026-${s}:00Z`);

export const FIXED_NOW = d('10-27T16:00');

export const PAIRS: Pair[] = [
  {
    id: 'temple-usds',
    bidToken: 'TEMPLE',
    fillToken: 'USDS',
    wishedFor: 2_410_000,
  },
  {
    id: 'tgld-usds',
    bidToken: 'TGLD',
    fillToken: 'USDS',
    wishedFor: 18_600_000,
  },
  {
    id: 'usds-temple',
    bidToken: 'USDS',
    fillToken: 'TEMPLE',
    wishedFor: 900_000,
  },
  { id: 'tgld-ena', bidToken: 'TGLD', fillToken: 'ENA', wishedFor: 3_200_000 },
  { id: 'tgld-wsteth', bidToken: 'TGLD', fillToken: 'wstETH', wishedFor: 0 },
];

type Spec = {
  n: number;
  price: number;
  created: string;
  start: string;
  depEnd: string;
  fulEnd: string;
  deposits: number;
  fill?: number; // funded fraction; settled by the clock when fulEnd has passed
  cancelled?: string;
  paused?: boolean;
  funding?: number;
};

const auctions = (bid: Token, fill: Token, specs: Spec[]): Auction[] =>
  specs.map((s) => {
    const fulfillmentEnd = d(s.fulEnd);
    const settled = !s.cancelled && fulfillmentEnd <= FIXED_NOW;
    return {
      id: `${bid}-${fill}-${s.n}`.toLowerCase(),
      bidToken: bid,
      fillToken: fill,
      number: s.n,
      price: s.price,
      createdAt: d(s.created),
      depositStart: d(s.start),
      depositEnd: d(s.depEnd),
      fulfillmentEnd,
      outcome: s.cancelled ? 'Cancelled' : settled ? 'Settled' : 'None',
      settledAt: settled ? fulfillmentEnd : undefined,
      cancelledAt: s.cancelled ? d(s.cancelled) : undefined,
      paused: !!s.paused,
      totalDeposits: s.deposits,
      funding: s.funding ?? s.deposits * s.price * (s.fill ?? 0),
    };
  });

export const AUCTIONS: Auction[] = [
  ...auctions('TEMPLE', 'USDS', [
    {
      n: 1,
      price: 1.1,
      created: '06-30T14:00',
      start: '07-07T14:00',
      depEnd: '07-11T14:00',
      fulEnd: '07-18T14:00',
      deposits: 900_000,
      fill: 1,
    },
    {
      n: 2,
      price: 1.11,
      created: '07-28T14:00',
      start: '08-04T14:00',
      depEnd: '08-08T14:00',
      fulEnd: '08-15T14:00',
      deposits: 800_000,
      cancelled: '08-09T14:00',
    },
    {
      n: 3,
      price: 1.12,
      created: '08-25T14:00',
      start: '09-01T14:00',
      depEnd: '09-05T14:00',
      fulEnd: '09-12T14:00',
      deposits: 1_200_000,
      fill: 0.75,
    },
    {
      n: 4,
      price: 1.12,
      created: '10-20T14:00',
      start: '10-27T00:00',
      depEnd: '10-30T14:00',
      fulEnd: '11-06T14:00',
      deposits: 1_000_000,
    },
  ]),
  ...auctions('TGLD', 'USDS', [
    {
      n: 1,
      price: 0.041,
      created: '02-26T14:00',
      start: '03-02T14:00',
      depEnd: '03-06T14:00',
      fulEnd: '03-13T14:00',
      deposits: 6_100_000,
      fill: 1,
    },
    {
      n: 2,
      price: 0.0418,
      created: '04-01T14:00',
      start: '04-05T14:00',
      depEnd: '04-09T14:00',
      fulEnd: '04-16T14:00',
      deposits: 7_400_000,
      fill: 0.92,
    },
    {
      n: 3,
      price: 0.0425,
      created: '05-02T14:00',
      start: '05-06T14:00',
      depEnd: '05-10T14:00',
      fulEnd: '05-17T14:00',
      deposits: 2_000_000,
      cancelled: '05-13T14:00',
    },
    {
      n: 4,
      price: 0.0431,
      created: '05-30T14:00',
      start: '06-03T14:00',
      depEnd: '06-07T14:00',
      fulEnd: '06-14T14:00',
      deposits: 8_200_000,
      fill: 1,
    },
    {
      n: 5,
      price: 0.044,
      created: '08-16T14:00',
      start: '08-20T14:00',
      depEnd: '08-24T14:00',
      fulEnd: '08-31T14:00',
      deposits: 8_800_000,
      fill: 1,
    },
    {
      n: 6,
      price: 0.0452,
      created: '09-20T14:00',
      start: '09-24T14:00',
      depEnd: '09-28T14:00',
      fulEnd: '10-05T14:00',
      deposits: 9_000_000,
      fill: 1,
    },
    {
      n: 7,
      price: 0.0466,
      created: '10-10T14:00',
      start: '10-14T14:00',
      depEnd: '10-21T22:00',
      fulEnd: '10-28T22:00',
      deposits: 438_000 / 0.0466,
      funding: 267_200,
    },
    {
      n: 8,
      price: 0.047,
      created: '10-22T14:00',
      start: '10-25T14:00',
      depEnd: '11-01T14:00',
      fulEnd: '11-08T14:00',
      deposits: 4_200_000,
      paused: true,
    },
  ]),
  ...auctions('USDS', 'TEMPLE', [
    {
      n: 1,
      price: 0.89,
      created: '08-12T14:00',
      start: '08-16T14:00',
      depEnd: '08-20T14:00',
      fulEnd: '08-27T14:00',
      deposits: 400_000,
      fill: 1,
    },
    {
      n: 2,
      price: 0.89,
      created: '10-01T14:00',
      start: '10-05T14:00',
      depEnd: '10-09T14:00',
      fulEnd: '10-16T14:00',
      deposits: 500_000,
      fill: 1,
    },
  ]),
  ...auctions('TGLD', 'ENA', [
    {
      n: 1,
      price: 0.27,
      created: '08-18T14:00',
      start: '08-22T14:00',
      depEnd: '08-26T14:00',
      fulEnd: '09-02T14:00',
      deposits: 3_000_000,
      fill: 1,
    },
    {
      n: 2,
      price: 0.28,
      created: '10-24T14:00',
      start: '10-31T14:00',
      depEnd: '11-03T14:00',
      fulEnd: '11-10T14:00',
      deposits: 0,
    },
  ]),
];

export const POSITIONS: Position[] = [
  { auction: 'temple-usds-4', deposit: 10_000, claimed: false },
  { auction: 'tgld-usds-8', deposit: 40_000, claimed: false },
  { auction: 'temple-usds-3', deposit: 10_000, claimed: false },
  { auction: 'temple-usds-2', deposit: 10_000, claimed: true },
  { auction: 'tgld-usds-4', deposit: 12_000, claimed: true },
];

export const WISHES: Wish[] = [
  // made a moment ago on the wish screen (storyboard frame 9), so it shows as new
  {
    from: 'TGLD',
    to: 'wstETH',
    amount: 2_000,
    expiry: d('11-26T16:00'),
    isNew: true,
  },
  { from: 'TGLD', to: 'ENA', amount: 5_000, expiry: d('10-30T16:00') },
  { from: 'TEMPLE', to: 'USDS', amount: 25_000, expiry: d('11-26T16:00') },
];

// The indexer's latest block, for "updated N min ago" and the pinned demand block.
export const INDEXER_STATUS = {
  blockNumber: 26_412_880,
  blockTime: new Date(+FIXED_NOW - 2 * 60_000),
};

export const WALLET: Partial<Record<Token, number>> = {
  TEMPLE: 12_400,
  TGLD: 3_180,
};

export const STAKING = { staked: 50_000, rewards: 210 };

export const TOKENS: Token[] = ['TGLD', 'TEMPLE', 'USDS', 'ENA', 'wstETH'];
