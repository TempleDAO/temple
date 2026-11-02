import type {
  Auction,
  Balances,
  IndexerStatus,
  Pair,
  Position,
  SetWishRequest,
  Settlement,
  StakingSummary,
  Token,
  TxReceipt,
  Wish,
} from './types';

// Everything GranaryProvider reads and writes goes through this interface.
// liveSource.ts implements it: auctions, pairs, positions and wishes from the
// Granary indexer; balances, claims, staking and compliance from the contracts
// in getAppConfig().granary.
export interface GranaryDataSource {
  /* ---------- indexer reads, pinned to one block ---------- */
  getAuctions(): Promise<Auction[]>;
  getPairs(): Promise<Pair[]>;
  getWishTokens(): Promise<Token[]>;
  getIndexerStatus(): Promise<IndexerStatus>;

  /* ---------- account reads ---------- */
  getPositions(account: string): Promise<Position[]>;
  getWishes(account: string): Promise<Wish[]>;

  /* ---------- contract reads ---------- */
  getClaimable(account: string, auction: Auction): Promise<Settlement | null>;
  getBalances(account: string): Promise<Balances>;
  getStaking(account: string): Promise<StakingSummary>;
  // The compliance lists (of those given) that flag the account. A list whose
  // isFlagged() reverts counts as flagging it.
  getFlaggedLists(account: string, lists: string[]): Promise<string[]>;

  /* ---------- writes: each resolves once mined and indexed ---------- */
  // FixedPriceAuction.deposit(amount), after ensuring the bid token allowance
  deposit(
    account: string,
    auction: Auction,
    amount: string
  ): Promise<TxReceipt>;
  // FixedPriceAuction.withdrawDeposit(amount); 'all' withdraws the exact deposit
  withdrawDeposit(
    account: string,
    auction: Auction,
    amount: string | 'all'
  ): Promise<TxReceipt>;
  // FixedPriceAuction.claim()
  claim(account: string, auction: Auction): Promise<TxReceipt>;
  // FixedPriceAuction.withdrawExcluded()
  withdrawExcluded(account: string, auction: Auction): Promise<TxReceipt>;
  // WishingWell.wish(give, get, amount, expiresAt)
  setWish(account: string, req: SetWishRequest): Promise<TxReceipt>;
  // WishingWell.wish(give, get, 0, 0)
  revokeWish(account: string, wish: Wish): Promise<TxReceipt>;
}

// Contract errors the UI explains in words. The data source decodes reverts
// into a GranaryError carrying the custom error name.
export type GranaryErrorCode =
  | 'InvalidPhase'
  | 'IsPaused'
  | 'FlaggedAccount'
  | 'DepositBelowMinimum'
  | 'InsufficientBalance'
  | 'AlreadyClaimed'
  | 'NothingToClaim'
  | 'ExpectedNonZero'
  | 'InvalidAmount'
  | 'NotDeployed'
  | 'WrongNetwork'
  | 'UserRejected';

export class GranaryError extends Error {
  constructor(public code: GranaryErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'GranaryError';
  }
}
