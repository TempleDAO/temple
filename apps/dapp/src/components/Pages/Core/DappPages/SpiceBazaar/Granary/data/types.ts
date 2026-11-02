export type Token = 'TEMPLE' | 'USDS' | 'TGLD' | 'ENA' | 'wstETH';

export type Phase =
  | 'Scheduled'
  | 'Deposit'
  | 'Fulfillment'
  | 'Settlement'
  | 'Cancelled';

export type Pair = {
  id: string;
  bidToken: Token;
  fillToken: Token;
  // counted WishingWell demand, in bidToken, at the indexer's pinned block
  wishedFor: number;
};

// One FixedPriceAuction as the indexer will return it: config plus latest state.
// shortcut: amounts are whole-token numbers, swap to bigint + decimals when wiring the indexer.
export type Auction = {
  id: string; // the auction's address once indexed
  bidToken: Token;
  fillToken: Token;
  number: number;
  price: number; // fillToken per whole bidToken
  createdAt: Date;
  depositStart: Date;
  depositEnd: Date;
  fulfillmentEnd: Date;
  outcome: 'None' | 'Settled' | 'Cancelled';
  settledAt?: Date;
  cancelledAt?: Date;
  paused: boolean;
  totalDeposits: number;
  funding: number;
};

// The connected account's deposit in one auction.
export type Position = { auction: string; deposit: number; claimed: boolean };

// A WishingWell wish; one per (from, to) for the account.
export type Wish = {
  from: Token;
  to: Token;
  amount: number;
  expiry: Date;
  isNew?: boolean;
};
