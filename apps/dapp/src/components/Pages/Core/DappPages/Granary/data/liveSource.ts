import {
  BigNumber,
  Contract,
  PopulatedTransaction,
  Signer,
  constants,
  utils,
} from 'ethers';
import type { ProviderApi } from 'services/ProviderApi';
import type {
  ContractConfig,
  GranaryConfig,
  TokenConfig,
} from 'constants/newenv/types';
import {
  ERC20__factory,
  IFixedPriceAuction,
  IFixedPriceAuction__factory,
  IWishingWell,
  IWishingWell__factory,
  TempleGoldStaking,
  TempleGoldStaking__factory,
} from 'types/typechain';
import { estimateAndMine } from 'utils/ethers';
import { pairIdOf } from './derive';
import { GranaryDataSource, GranaryError, GranaryErrorCode } from './source';
import type {
  Auction,
  Balances,
  Pair,
  Position,
  Token,
  TxReceipt,
  Wish,
} from './types';

// GranaryDataSource over the contracts in getAppConfig().granary, read through
// the chain's RPC with no indexer.
//
// TODO(granary-subgraph): the reads below that loop over every configured
// auction or token pair, or can't be answered on-chain at all, move to the
// Granary indexer (spec/indexer-implementation-spec.md §7). Each one is marked.

// What the source needs from the connected wallet, supplied by GranaryProvider.
export type GranaryWallet = {
  // a signer on the Granary chain (switches the wallet's network first)
  getSigner: () => Promise<Signer>;
  ensureAllowance: (
    symbol: string,
    token: string,
    spender: string,
    amount: BigNumber,
    signer: Signer
  ) => Promise<void>;
};

export type LiveSourceDeps = {
  papi: ProviderApi;
  config: GranaryConfig;
  // every token configured for the app; the source keeps the ones on its chain
  tokens: TokenConfig[];
  staking?: ContractConfig<Contract>;
  getWallet: () => GranaryWallet;
};

type TokenMeta = { address: string; symbol: Token; decimals: number };

// The auction's terms, fixed at creation.
type AuctionTerms = {
  bid: TokenMeta;
  fill: TokenMeta;
  price: number;
  depositStart: Date;
  depositEnd: Date;
  fulfillmentEnd: Date;
  minDeposit: number;
};

const PHASES = [
  'Scheduled',
  'Deposit',
  'Fulfillment',
  'Settlement',
  'Cancelled',
] as const;

export const isDeployed = (c?: { address?: string }) =>
  !!c?.address && c.address !== constants.AddressZero;

const toNum = (v: BigNumber, decimals: number) =>
  Number(utils.formatUnits(v, decimals));
const toDate = (secs: BigNumber | number) => new Date(Number(secs) * 1000);

const parseAmount = (amount: string, decimals: number) => {
  let v: BigNumber;
  try {
    v = utils.parseUnits(amount.replace(/,/g, '').trim(), decimals);
  } catch {
    throw new GranaryError('InvalidAmount');
  }
  if (v.lte(0)) throw new GranaryError('ExpectedNonZero');
  return v;
};

/* ---------- revert decoding ---------- */

// Every custom error a Granary write can revert with: the auction's own,
// CommonEventsAndErrors' (merged into its ABI), and OpenZeppelin ERC20's.
const ERRORS = new utils.Interface([
  ...IFixedPriceAuction__factory.abi.filter((f) => f.type === 'error'),
  'error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)',
  'error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)',
]);

const ERROR_CODES: Record<string, GranaryErrorCode> = {
  InvalidPhase: 'InvalidPhase',
  IsPaused: 'IsPaused',
  FlaggedAccount: 'FlaggedAccount',
  DepositBelowMinimum: 'DepositBelowMinimum',
  InsufficientBalance: 'InsufficientBalance',
  ERC20InsufficientBalance: 'InsufficientBalance',
  AlreadyClaimed: 'AlreadyClaimed',
  NothingToClaim: 'NothingToClaim',
  ExpectedNonZero: 'ExpectedNonZero',
  InvalidAmount: 'InvalidAmount',
};

// Wallets and ethers nest the revert data at different depths.
const findRevertData = (err: unknown, depth = 0): string | undefined => {
  if (!err || typeof err !== 'object' || depth > 5) return undefined;
  const o = err as Record<string, unknown>;
  for (const k of ['data', 'error', 'originalError', 'cause', 'info']) {
    const v = o[k];
    if (typeof v === 'string' && /^0x[0-9a-f]{8}/i.test(v)) return v;
    const nested = findRevertData(v, depth + 1);
    if (nested) return nested;
  }
  if (typeof o.body === 'string') {
    try {
      return findRevertData(JSON.parse(o.body), depth + 1);
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const toGranaryError = (err: unknown): unknown => {
  const e = err as { code?: unknown; message?: string };
  if (e?.code === 'ACTION_REJECTED' || e?.code === 4001)
    return new GranaryError('UserRejected');
  const data = findRevertData(err);
  if (data) {
    try {
      const code = ERROR_CODES[ERRORS.parseError(data).name];
      if (code) return new GranaryError(code);
    } catch {
      // not one of ours; fall through
    }
  }
  if (/exceeds balance/i.test(e?.message ?? ''))
    return new GranaryError('InsufficientBalance');
  return err;
};

/* ---------- the source ---------- */

export const createLiveSource = ({
  papi,
  config,
  tokens,
  staking,
  getWallet,
}: LiveSourceDeps): GranaryDataSource => {
  const provider = papi.getProvider(config.chainId);
  const auctionConfigs = config.auctions.filter(isDeployed);
  const wellDeployed = isDeployed(config.wishingWell);
  const well = IWishingWell__factory.connect(
    config.wishingWell.address,
    provider
  ) as IWishingWell;
  const auctionAt = (address: string) =>
    IFixedPriceAuction__factory.connect(
      address,
      provider
    ) as IFixedPriceAuction;

  /* ----- tokens ----- */

  const onChain = (ts: TokenConfig[]): TokenMeta[] =>
    ts
      .filter((t) => t.chainId === config.chainId && isDeployed(t))
      .map((t) => ({
        address: t.address as string,
        symbol: t.symbol,
        decimals: t.decimals,
      }));
  const wishTokens = onChain(config.wishTokens);

  const byAddress = new Map<string, Promise<TokenMeta>>();
  // configured symbols win over the token's own (Sepolia's USDS calls itself DAI)
  for (const t of [...wishTokens, ...onChain(tokens)]) {
    const key = t.address.toLowerCase();
    if (!byAddress.has(key)) byAddress.set(key, Promise.resolve(t));
  }

  const tokenAt = (address: string) => {
    const key = address.toLowerCase();
    let t = byAddress.get(key);
    if (!t) {
      const erc20 = ERC20__factory.connect(address, provider);
      t = Promise.all([erc20.symbol(), erc20.decimals()]).then(
        ([symbol, decimals]) => ({ address, symbol, decimals })
      );
      byAddress.set(key, t);
    }
    return t;
  };

  /* ----- auctions ----- */

  // An auction's terms never change, so read them once.
  const terms = new Map<string, Promise<AuctionTerms>>();
  const termsOf = (address: string) => {
    let t = terms.get(address);
    if (!t) {
      t = auctionAt(address)
        .getConfig()
        .then(async (c) => {
          const [bid, fill] = await Promise.all([
            tokenAt(c.bidToken),
            tokenAt(c.fillToken),
          ]);
          return {
            bid,
            fill,
            // fill tokens per whole bid token, scaled by 1e18
            price: toNum(c.price, 18),
            depositStart: toDate(c.depositStart),
            depositEnd: toDate(c.depositEnd),
            fulfillmentEnd: toDate(c.fulfillmentEnd),
            minDeposit: toNum(c.minDeposit, bid.decimals),
          };
        });
      t.catch(() => terms.delete(address));
      terms.set(address, t);
    }
    return t;
  };

  const readAuction = async (address: string, blockTime: Date) => {
    const fpa = auctionAt(address);
    const [t, phase, paused, totalDeposits, funding, settledAt, settlement] =
      await Promise.all([
        termsOf(address),
        fpa.phase(),
        fpa.paused(),
        fpa.totalDeposits(),
        fpa.funding(),
        fpa.settledAt(),
        fpa.settlement(),
      ]);
    const p = PHASES[phase];
    // phase() says Settlement before fulfillmentEnd only after settleEarly()
    const early = p === 'Settlement' && blockTime < t.fulfillmentEnd;
    const auction: Omit<Auction, 'number'> = {
      id: address,
      bidToken: t.bid.symbol,
      fillToken: t.fill.symbol,
      price: t.price,
      // TODO(granary-subgraph): createdAt and cancelledAt come from the
      // AuctionCreated / AuctionCancelled events.
      createdAt: undefined,
      depositStart: t.depositStart,
      depositEnd: t.depositEnd,
      fulfillmentEnd: t.fulfillmentEnd,
      outcome: p === 'Cancelled' ? 'Cancelled' : early ? 'Settled' : 'None',
      settledAt:
        settledAt > 0 ? toDate(settledAt) : early ? blockTime : undefined,
      cancelledAt: undefined,
      paused,
      totalDeposits: toNum(totalDeposits, t.bid.decimals),
      funding: toNum(funding, t.fill.decimals),
      filledBids: toNum(settlement.filledBids, t.bid.decimals),
      minDeposit: t.minDeposit,
    };
    return auction;
  };

  const blockTime = async () => {
    const b = await provider.getBlock('latest');
    return { blockNumber: b.number, blockTime: toDate(b.timestamp) };
  };

  // TODO(granary-subgraph): one query for every auction the factory created,
  // with the indexer's per-pair `number`. Today: each configured auction, read
  // directly (7 calls each), numbered per pair by deposit start.
  const getAuctions = async (): Promise<Auction[]> => {
    const { blockTime: now } = await blockTime();
    const read = await Promise.all(
      auctionConfigs.map((c) => readAuction(c.address, now))
    );
    const seen = new Map<string, number>();
    return read
      .sort((a, b) => +a.depositStart - +b.depositStart)
      .map((a) => {
        const pair = pairIdOf(a.bidToken, a.fillToken);
        const number = (seen.get(pair) ?? 0) + 1;
        seen.set(pair, number);
        return { ...a, number };
      });
  };

  const auctionTerms = async (a: Auction) => termsOf(a.id);

  // Every ordered pair of wish tokens, plus every auction's pair.
  const wishPairs = async () => {
    const pairs = new Map<string, [TokenMeta, TokenMeta]>();
    for (const g of wishTokens)
      for (const t of wishTokens)
        if (g.address !== t.address)
          pairs.set(pairIdOf(g.symbol, t.symbol), [g, t]);
    for (const c of auctionConfigs) {
      const t = await termsOf(c.address);
      pairs.set(pairIdOf(t.bid.symbol, t.fill.symbol), [t.bid, t.fill]);
    }
    return Array.from(pairs.values());
  };

  /* ----- wallet ----- */

  const send = async (
    build: (signer: Signer) => Promise<PopulatedTransaction>
  ): Promise<TxReceipt> => {
    try {
      const signer = await getWallet().getSigner();
      const receipt = await estimateAndMine(signer, await build(signer));
      return { hash: receipt.transactionHash };
    } catch (err) {
      throw toGranaryError(err);
    }
  };

  // Wishes made this session, for the "new" chip.
  const madeThisSession = new Set<string>();

  return {
    getAuctions,

    // TODO(granary-subgraph): Pair entities, with wishedFor computed from
    // WishSet rows and fills at a pinned block (spec §6.5). Wish demand is
    // aggregated across every account, so it can't be read from the contract.
    // Today: one pair per configured auction's (bid, fill).
    async getPairs() {
      const pairs = new Map<string, Pair>();
      for (const c of auctionConfigs) {
        const t = await termsOf(c.address);
        const id = pairIdOf(t.bid.symbol, t.fill.symbol);
        pairs.set(id, {
          id,
          bidToken: t.bid.symbol,
          fillToken: t.fill.symbol,
          wishedFor: undefined,
        });
      }
      return Array.from(pairs.values());
    },

    async getWishTokens() {
      return wellDeployed ? wishTokens.map((t) => t.symbol) : [];
    },

    getIndexerStatus: blockTime,

    // TODO(granary-subgraph): FixedPriceAuctionPosition rows for the account
    // (with claimedFill / claimedRefund). Today: 3 calls per configured auction.
    async getPositions(account) {
      const rows = await Promise.all(
        auctionConfigs.map(async (c): Promise<Position> => {
          const fpa = auctionAt(c.address);
          const [t, deposit, claimed, excluded] = await Promise.all([
            termsOf(c.address),
            fpa.deposits(account),
            fpa.claimed(account),
            fpa.excluded(account),
          ]);
          return {
            auction: c.address,
            deposit: toNum(deposit, t.bid.decimals),
            claimed,
            excluded: toNum(excluded, t.bid.decimals),
          };
        })
      );
      return rows.filter((p) => p.deposit > 0 || p.excluded > 0);
    },

    // TODO(granary-subgraph): the account's WishSet rows. Today: wishOf for
    // every configured token pair, so wishes for other tokens don't show.
    async getWishes(account) {
      if (!wellDeployed) return [];
      const pairs = await wishPairs();
      const rows = await Promise.all(
        pairs.map(async ([give, get]): Promise<Wish | null> => {
          const w = await well.wishOf(account, give.address, get.address);
          if (w.fromAmount.isZero()) return null;
          const key = `${account}:${pairIdOf(give.symbol, get.symbol)}`;
          return {
            give: give.symbol,
            get: get.symbol,
            amount: toNum(w.fromAmount, give.decimals),
            expiresAt: toDate(w.expiresAt),
            isNew: madeThisSession.has(key.toLowerCase()),
          };
        })
      );
      return rows.filter((w): w is Wish => !!w);
    },

    async getClaimable(account, a) {
      const fpa = auctionAt(a.id);
      const [t, c, deposit] = await Promise.all([
        auctionTerms(a),
        fpa.claimable(account),
        fpa.deposits(account),
      ]);
      if (c.fill.isZero() && c.refund.isZero()) return null;
      return {
        filledBid: toNum(deposit.sub(c.refund), t.bid.decimals),
        fill: toNum(c.fill, t.fill.decimals),
        refund: toNum(c.refund, t.bid.decimals),
      };
    },

    async getBalances(account) {
      const seen = new Map<string, TokenMeta>();
      wishTokens.forEach((t) => seen.set(t.symbol, t));
      for (const c of auctionConfigs) {
        const t = await termsOf(c.address);
        seen.set(t.bid.symbol, t.bid);
        seen.set(t.fill.symbol, t.fill);
      }
      const out: Balances = {};
      await Promise.all(
        Array.from(seen.values()).map(async (t) => {
          const v = await ERC20__factory.connect(t.address, provider).balanceOf(
            account
          );
          out[t.symbol] = toNum(v, t.decimals);
        })
      );
      return out;
    },

    async getStaking(account) {
      if (!isDeployed(staking) || staking?.chainId !== config.chainId)
        return { staked: 0, rewards: 0 };
      const s = TempleGoldStaking__factory.connect(
        staking.address,
        provider
      ) as TempleGoldStaking;
      const [staked, rewards] = await Promise.all([
        s.balanceOf(account),
        s.earned(account),
      ]);
      return { staked: toNum(staked, 18), rewards: toNum(rewards, 18) };
    },

    /* ----- writes ----- */

    async deposit(account, a, amount) {
      const t = await auctionTerms(a);
      const v = parseAmount(amount, t.bid.decimals);
      return send(async (signer) => {
        await getWallet().ensureAllowance(
          t.bid.symbol,
          t.bid.address,
          a.id,
          v,
          signer
        );
        return auctionAt(a.id).connect(signer).populateTransaction.deposit(v);
      });
    },

    async withdrawDeposit(account, a, amount) {
      const t = await auctionTerms(a);
      const v =
        amount === 'all'
          ? await auctionAt(a.id).deposits(account)
          : parseAmount(amount, t.bid.decimals);
      if (v.isZero()) throw new GranaryError('NothingToClaim');
      return send((signer) =>
        auctionAt(a.id).connect(signer).populateTransaction.withdrawDeposit(v)
      );
    },

    async claim(account, a) {
      return send((signer) =>
        auctionAt(a.id).connect(signer).populateTransaction.claim()
      );
    },

    async withdrawExcluded(account, a) {
      return send((signer) =>
        auctionAt(a.id).connect(signer).populateTransaction.withdrawExcluded()
      );
    },

    async setWish(account, { give, get, amount, durationDays }) {
      if (!wellDeployed) throw new GranaryError('NotDeployed');
      const g = wishTokens.find((t) => t.symbol === give);
      const r = wishTokens.find((t) => t.symbol === get);
      if (!g || !r || g === r) throw new GranaryError('InvalidAmount');
      const v = parseAmount(amount, g.decimals);
      // the expiry is set from the wall clock (spec §6.1)
      const expiresAt = Math.floor(Date.now() / 1000 + durationDays * 86_400);
      const receipt = await send((signer) =>
        well
          .connect(signer)
          .populateTransaction.wish(g.address, r.address, v, expiresAt)
      );
      madeThisSession.add(`${account}:${pairIdOf(give, get)}`.toLowerCase());
      return receipt;
    },

    async revokeWish(account, w) {
      if (!wellDeployed) throw new GranaryError('NotDeployed');
      const g = await wishPairs().then((ps) =>
        ps.find(([a, b]) => a.symbol === w.give && b.symbol === w.get)
      );
      if (!g) throw new GranaryError('InvalidAmount');
      const receipt = await send((signer) =>
        well
          .connect(signer)
          .populateTransaction.wish(g[0].address, g[1].address, 0, 0)
      );
      madeThisSession.delete(
        `${account}:${pairIdOf(w.give, w.get)}`.toLowerCase()
      );
      return receipt;
    },
  };
};
