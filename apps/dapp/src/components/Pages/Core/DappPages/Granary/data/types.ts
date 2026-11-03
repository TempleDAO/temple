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
  // the compliance list deposits and claims check; undefined once disabled
  complianceCheck?: string;
  // TempleGold allows this auction to move TGLD; null when neither leg is TGLD
  tgldAuthorized: boolean | null;
};

// The connected account's deposit in one auction.
export type Position = {
  auction: string;
  deposit: number;
  claimed: boolean;
  // deposit moved out of the fill by exclude(); refund only, via withdrawExcluded()
  excluded: number;
  // what claim() paid, once claimed
  claimedFill?: number;
  claimedRefund?: number;
};

// What claim() pays one depositor (IFixedPriceAuction.UserClaim).
export type Settlement = { filledBid: number; fill: number; refund: number };

// A WishingWell wish: the account would give up to `amount` of `give` to get
// `get`, until `expiresAt`. One per (account, give, get).
export type Wish = {
  give: Token;
  get: Token;
  amount: number; // for display
  // the stored amount exactly, as a decimal string: edits and extensions
  // resend it, and `amount` can be off in the last decimals
  amountExact: string;
  expiresAt: Date;
  // made during this session (client-only, spec §7.5)
  isNew?: boolean;
};

// The indexer's latest block: every read is pinned to it, and phases use its
// time rather than the wall clock.
export type IndexerStatus = {
  blockNumber: number;
  blockTime: Date;
  hasIndexingErrors: boolean;
};

// TempleGoldStaking: the pool's totals, and the account's stake when one is
// connected (zeros otherwise).
export type StakingSummary = {
  totalStaked: number; // TEMPLE
  circulatingTgld: number;
  // TGLD the pool pays out over a week at the current rate; 0 once the reward
  // period has finished
  weeklyRewards: number;
  cooldownDays: number; // lock after each stake
  paused: boolean;
  staked: number; // TEMPLE
  // exact amounts as decimal strings, for Max
  stakedExact: string;
  available: number; // TEMPLE in the wallet
  availableExact: string;
  rewards: number; // TGLD earned, claimable now
  dailyReward: number; // the account's share of a day's rewards
  // when the stake can be withdrawn; undefined if it never staked
  unstakeAt?: Date;
  // undefined while undelegated
  delegate?: string;
};

export type Balances = Partial<Record<Token, number>>;

export type SetWishRequest = {
  give: Token;
  get: Token;
  amount: string; // whole tokens of give, no separators
  durationDays: number;
};

// A mined transaction.
export type TxReceipt = { hash: string; blockNumber: number };
