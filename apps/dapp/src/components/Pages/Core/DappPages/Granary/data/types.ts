// Shapes the Granary screens read. The data source (see source.ts) produces
// them from the FixedPriceAuction / WishingWell contracts (and, later, the
// Granary indexer). Amounts are whole-token numbers for display; the data
// source converts to and from base units with each token's decimals.

// A token's symbol, as configured in constants/newenv for its address.
export type Token = string;

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
  // WishingWell demand for this pair, in bidToken. Undefined until the
  // indexer serves it (spec §6.5).
  wishedFor?: number;
};

// One FixedPriceAuction: its config plus latest state.
export type Auction = {
  id: string; // the auction contract's address
  bidToken: Token;
  fillToken: Token;
  number: number; // per pair, in creation order
  price: number; // fillToken per whole bidToken
  createdAt?: Date;
  depositStart: Date;
  depositEnd: Date;
  fulfillmentEnd: Date;
  // 'Settled' only for settleEarly(); a clock settlement stays 'None'.
  outcome: 'None' | 'Settled' | 'Cancelled';
  settledAt?: Date;
  cancelledAt?: Date;
  paused: boolean;
  totalDeposits: number;
  funding: number; // fill tokens held
  // settlement().filledBids: bid tokens the funding fills
  filledBids?: number;
  minDeposit: number;
};

// The connected account's deposit in one auction.
export type Position = {
  auction: string;
  deposit: number;
  claimed: boolean;
  // deposit moved out of the fill by exclude(); refund only, via withdrawExcluded()
  excluded: number;
};

// What claim() pays one depositor (IFixedPriceAuction.UserClaim).
export type Settlement = { filledBid: number; fill: number; refund: number };

// A WishingWell wish: the account would give up to `amount` of `give` to get
// `get`, until `expiresAt`. One per (account, give, get).
export type Wish = {
  give: Token;
  get: Token;
  amount: number;
  expiresAt: Date;
  // made during this session (client-only, spec §7.5)
  isNew?: boolean;
};

export type IndexerStatus = { blockNumber: number; blockTime: Date };

export type StakingSummary = { staked: number; rewards: number };

export type Balances = Partial<Record<Token, number>>;

export type SetWishRequest = {
  give: Token;
  get: Token;
  amount: string; // whole tokens of give, no separators
  durationDays: number;
};

// A mined transaction.
export type TxReceipt = { hash: string };
