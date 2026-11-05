import type { DecimalBigNumber } from 'utils/DecimalBigNumber';

// Shapes the Granary screens read. The data source (see source.ts) produces
// them from the Granary indexer and the contracts.

// A token amount in whole tokens, exact: it carries its token's decimals.
// derive.ts formats it for display.
export type Amount = DecimalBigNumber;

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
  wishedFor?: Amount;
};

// One FixedPriceAuction: its config plus latest state.
export type Auction = {
  id: string; // the auction contract's address
  bidToken: Token;
  fillToken: Token;
  number: number; // per pair, in creation order
  price: Amount; // fillToken per whole bidToken
  createdAt?: Date;
  depositStart: Date;
  depositEnd: Date;
  fulfillmentEnd: Date;
  // claim() and withdrawExcluded() ignore a pause after this
  claimPauseEndsAt: Date;
  // 'Settled' only for settleEarly(); a clock settlement stays 'None'.
  outcome: 'None' | 'Settled' | 'Cancelled';
  settledAt?: Date;
  cancelledAt?: Date;
  paused: boolean;
  totalDeposits: Amount;
  funding: Amount; // fill tokens held
  // settlement().filledBids: bid tokens the funding fills
  filledBids?: Amount;
  minDeposit: Amount;
  // the compliance list deposits and claims check; undefined once disabled
  complianceCheck?: string;
  // TempleGold allows this auction to move TGLD; null when neither leg is TGLD
  tgldAuthorized: boolean | null;
};

// The connected account's deposit in one auction.
export type Position = {
  auction: string;
  deposit: Amount;
  claimed: boolean;
  // deposit moved out of the fill by exclude(); refund only, via withdrawExcluded()
  excluded: Amount;
  // what claim() paid, once claimed
  claimedFill?: Amount;
  claimedRefund?: Amount;
};

// What claim() pays one depositor (IFixedPriceAuction.UserClaim).
export type Settlement = { filledBid: Amount; fill: Amount; refund: Amount };

// A WishingWell wish: the account would give up to `amount` of `give` to get
// `get`, until `expiresAt`. One per (account, give, get).
export type Wish = {
  give: Token;
  get: Token;
  amount: Amount;
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
  totalStaked: Amount; // TEMPLE
  circulatingTgld: Amount;
  // TGLD the pool pays out over a week at the current rate; 0 once the reward
  // period has finished
  weeklyRewards: Amount;
  cooldownDays: number; // lock after each stake
  paused: boolean;
  staked: Amount; // TEMPLE
  available: Amount; // TEMPLE in the wallet
  rewards: Amount; // TGLD earned, claimable now
  dailyReward: Amount; // the account's share of a day's rewards
  // when the stake can be withdrawn; undefined if it never staked
  unstakeAt?: Date;
  // undefined while undelegated
  delegate?: string;
};

export type Balances = Partial<Record<Token, Amount>>;

export type SetWishRequest = {
  give: Token;
  get: Token;
  amount: string; // whole tokens of give, no separators
  durationDays: number;
};

// A mined transaction.
export type TxReceipt = { hash: string; blockNumber: number };
