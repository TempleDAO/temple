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
  IComplianceCheck__factory,
  IFixedPriceAuction,
  IFixedPriceAuction__factory,
  IWishingWell,
  IWishingWell__factory,
  TempleGold,
  TempleGold__factory,
  TempleGoldStaking,
  TempleGoldStaking__factory,
} from 'types/typechain';
import { estimateAndMine } from 'utils/ethers';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';
import {
  fromUnits,
  isPositive,
  pairIdOf,
  roundTo,
  whole,
  ZERO,
} from './derive';
import {
  createIndexer,
  RawAuction,
  RawMeta,
  RawPosition,
  RawWish,
} from './indexer';
import { GranaryDataSource, GranaryError, GranaryErrorCode } from './source';
import type {
  Amount,
  Auction,
  Balances,
  IndexerStatus,
  Pair,
  Position,
  StakingSummary,
  Token,
  TxReceipt,
  Wish,
} from './types';

// GranaryDataSource for getAppConfig().granary. Auctions, pairs, positions and
// wishes come from the Granary indexer, each read pinned to its latest block.
// Wallet balances, claimable(), staking and compliance are contract reads,
// as the indexer docs prescribe. Writes wait until the indexer has the block,
// except staking writes, which the indexer doesn't track.

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
  templeGold?: ContractConfig<Contract>;
  getWallet: () => GranaryWallet;
};

type TokenMeta = { address: string; symbol: Token; decimals: number };

// How long one _meta read pins every read that follows it.
const META_TTL_MS = 5_000;
// After a transaction: how often and how long to wait for the indexer.
const INDEX_POLL_MS = 2_000;
const INDEX_TIMEOUT_MS = 90_000;

export const isDeployed = (c?: { address?: string }) =>
  !!c?.address && c.address !== constants.AddressZero;

// The indexer's whole-token decimal strings ("12.5"; also "1.5E-7"), exactly.
const fromDecimal = (text: string, decimals: number) => {
  const [mantissa, exp = '0'] = text.trim().toLowerCase().split('e');
  const neg = mantissa.startsWith('-');
  const [int, frac = ''] = mantissa.replace(/^[-+]/, '').split('.');
  const digits = `${int}${frac}`;
  const point = int.length + Number(exp);
  const padded =
    point <= 0
      ? `0.${'0'.repeat(-point)}${digits}`
      : point >= digits.length
      ? digits + '0'.repeat(point - digits.length)
      : `${digits.slice(0, point)}.${digits.slice(point)}`;
  return DecimalBigNumber.parseUnits(`${neg ? '-' : ''}${padded}`, decimals);
};
const toDate = (secs: BigNumber | number | string) =>
  new Date(Number(secs) * 1000);
const optDate = (secs: string) => (secs === '0' ? undefined : toDate(secs));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
// TempleGoldStaking's (a separate interface: it shares some errors above)
const STAKING_ERRORS = new utils.Interface(
  TempleGoldStaking__factory.abi.filter((f) => f.type === 'error')
);

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
  InvalidAddress: 'InvalidAddress',
  EnforcedPause: 'StakingPaused',
  UnstakeCooldown: 'UnstakeLocked',
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
  if (err instanceof GranaryError) return err;
  const e = err as { code?: unknown; message?: string };
  if (e?.code === 'ACTION_REJECTED' || e?.code === 4001)
    return new GranaryError('UserRejected');
  const data = findRevertData(err);
  if (data) {
    for (const iface of [ERRORS, STAKING_ERRORS]) {
      try {
        const code = ERROR_CODES[iface.parseError(data).name];
        if (code) return new GranaryError(code);
      } catch {
        // not in this interface; try the next
      }
    }
  }
  if (/exceeds balance/i.test(e?.message ?? ''))
    return new GranaryError('InsufficientBalance');
  return err;
};

/* ---------- wish demand (indexer docs, "Demand") ---------- */

// Demand for one pair at time T: per account, its unexpired wish less what it
// has bought in the pair's auctions settled since it set the wish. No balance
// cap. Buckets (e.g. USDS + USDC as one "stables" side) aren't configured yet,
// so each pair stands alone.
const demandByPair = (
  wishes: RawWish[],
  positions: RawPosition[],
  T: number,
  tokenOf: (address: string) => TokenMeta | undefined
) => {
  const out = new Map<string, Amount>(); // pair id (addresses) → bid tokens
  const pairKey = (from: string, to: string) =>
    `${from}${to.slice(2)}`.toLowerCase();
  for (const w of wishes) {
    const from = tokenOf(w.fromToken);
    if (!from) continue;
    const active = w.fromAmount !== '0' && Number(w.expiresAt) > T;
    if (!active) continue;
    const wished = fromUnits(w.fromAmount, from.decimals);
    const key = pairKey(w.fromToken, w.toToken);
    // the wish's setAt is its pair's reset point: only later fills count
    const R = Number(w.setAt);
    let filled = ZERO;
    for (const p of positions) {
      const a = p.auctionInstance as RawAuction;
      if (!a.id || p.user.id.toLowerCase() !== w.account.toLowerCase())
        continue;
      if (pairKey(a.bidToken.id, a.auctionToken.id) !== key) continue;
      const final =
        a.outcome === 'Settled' ||
        (a.outcome === 'None' && T >= Number(a.fulfillmentEnd));
      if (!final) continue;
      const settleTime = a.settlementEmitted
        ? Number(a.settledAt)
        : Number(a.fulfillmentEnd);
      if (settleTime <= R) continue;
      const deposit = fromDecimal(p.totalBidAmount, from.decimals);
      if (deposit.isZero()) continue;
      if (p.hasClaimed)
        filled = filled.add(
          deposit.sub(fromDecimal(p.claimedRefundAmount, from.decimals))
        );
      else if (a.totalDeposits !== '0') {
        // the unfilled share of the deposit comes back as a refund
        const refund = roundTo(
          deposit
            .mul(fromUnits(a.userRefund, 0))
            .div(fromUnits(a.totalDeposits, 0), from.decimals),
          from.decimals
        );
        filled = filled.add(deposit.sub(refund));
      }
    }
    const left = wished.sub(filled);
    out.set(key, (out.get(key) ?? ZERO).add(left.gt(ZERO) ? left : ZERO));
  }
  return out;
};

/* ---------- the source ---------- */

export const createLiveSource = ({
  papi,
  config,
  tokens,
  staking,
  templeGold,
  getWallet,
}: LiveSourceDeps): GranaryDataSource => {
  const provider = papi.getProvider(config.chainId);
  const indexer = config.subgraphUrl ? createIndexer(config.subgraphUrl) : null;
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

  // Only tokens in the app's config are shown, with the config's symbol: the
  // indexer reads symbols from the token contracts, and Sepolia's USDS calls
  // itself DAI. Auctions and wishes in other tokens are left out.
  const known = new Map<string, TokenMeta>();
  for (const t of [...wishTokens, ...onChain(tokens)]) {
    const key = t.address.toLowerCase();
    if (!known.has(key)) known.set(key, t);
  }
  const tokenOf = (address: string) => known.get(address.toLowerCase());

  /* ----- the pinned block ----- */

  let meta: { at: number; value: Promise<RawMeta> } | undefined;
  const pinned = (fresh = false) => {
    if (!indexer) throw new Error('No Granary indexer configured');
    if (fresh || !meta || Date.now() - meta.at > META_TTL_MS) {
      const value = indexer.meta();
      value.catch(() => (meta = undefined));
      meta = { at: Date.now(), value };
    }
    return meta.value;
  };

  // After a write: wait for the indexer to reach the transaction's block.
  const waitForIndexed = async (block: number) => {
    if (!indexer) return;
    const until = Date.now() + INDEX_TIMEOUT_MS;
    while (Date.now() < until) {
      try {
        if ((await pinned(true)).block.number >= block) return;
      } catch (err) {
        // the transaction is mined either way; keep polling until the timeout
        console.warn('Granary: indexer status read failed', err);
      }
      await sleep(INDEX_POLL_MS);
    }
    console.warn(`Granary indexer hasn't reached block ${block} yet`);
  };

  /* ----- auctions ----- */

  // Tokens worth a balance read: the wish tokens and every shown auction's.
  // (The app's token config also lists addresses with no contract on testnets.)
  const inUse = new Map<string, TokenMeta>(
    wishTokens.map((t) => [t.address.toLowerCase(), t])
  );

  const toAuction = (r: RawAuction): Auction | null => {
    const bid = tokenOf(r.bidToken.id);
    const fill = tokenOf(r.auctionToken.id);
    if (!bid || !fill) return null;
    // the config's decimals scale every amount sent: skip the auction if they
    // disagree with the token contract's, as the indexer read them
    for (const [t, raw] of [
      [bid, r.bidToken],
      [fill, r.auctionToken],
    ] as const) {
      if (Number(raw.decimals) !== t.decimals) {
        console.warn(
          `Granary: ${t.symbol} has ${raw.decimals} decimals, config says ${t.decimals}`
        );
        return null;
      }
    }
    inUse.set(bid.address.toLowerCase(), bid);
    inUse.set(fill.address.toLowerCase(), fill);
    return {
      id: r.fixedPriceAuction.id,
      bidToken: bid.symbol,
      fillToken: fill.symbol,
      number: r.number,
      // fill tokens per whole bid token, scaled by 1e18
      price: fromUnits(r.fixedPrice, 18),
      createdAt: toDate(r.createdAt),
      depositStart: toDate(r.depositStart),
      depositEnd: toDate(r.depositEnd),
      fulfillmentEnd: toDate(r.fulfillmentEnd),
      claimPauseEndsAt: toDate(r.claimPauseEndsAt),
      outcome: r.outcome,
      settledAt: r.settlementEmitted ? optDate(r.settledAt) : undefined,
      cancelledAt:
        r.outcome === 'Cancelled' ? optDate(r.cancelledAt) : undefined,
      paused: r.paused,
      totalDeposits: fromUnits(r.totalDeposits, bid.decimals),
      funding: fromUnits(r.funding, fill.decimals),
      filledBids: fromUnits(r.filledBids, bid.decimals),
      minDeposit: fromUnits(r.minDeposit, bid.decimals),
      complianceCheck: r.complianceDisabled
        ? undefined
        : r.complianceCheck.toLowerCase(),
      tgldAuthorized: r.tgldAuthorized,
    };
  };

  // The auction's tokens, for amounts sent to the contract.
  const termsOf = async (a: Auction) => {
    const ts = Array.from(known.values());
    const bid = ts.find((t) => t.symbol === a.bidToken);
    const fill = ts.find((t) => t.symbol === a.fillToken);
    if (!bid || !fill) throw new Error(`Unknown tokens for ${a.id}`);
    return { bid, fill };
  };

  const toPosition = (p: RawPosition): Position | null => {
    const a = p.auctionInstance as RawAuction;
    const bid = a.id ? tokenOf(a.bidToken.id) : undefined;
    const fill = a.id ? tokenOf(a.auctionToken.id) : undefined;
    if (!bid || !fill) return null;
    return {
      auction: a.fixedPriceAuction.id,
      deposit: fromDecimal(p.totalBidAmount, bid.decimals),
      claimed: p.hasClaimed,
      excluded: fromDecimal(p.excludedAmount, bid.decimals),
      claimedFill: p.hasClaimed
        ? fromDecimal(p.claimedAmount, fill.decimals)
        : undefined,
      claimedRefund: p.hasClaimed
        ? fromDecimal(p.claimedRefundAmount, bid.decimals)
        : undefined,
    };
  };

  /* ----- wallet ----- */

  const send = async (
    build: (signer: Signer) => Promise<PopulatedTransaction>,
    { indexed = true } = {}
  ): Promise<TxReceipt> => {
    let receipt;
    try {
      const signer = await getWallet().getSigner();
      receipt = await estimateAndMine(signer, await build(signer));
    } catch (err) {
      throw toGranaryError(err);
    }
    if (indexed) await waitForIndexed(receipt.blockNumber);
    return { hash: receipt.transactionHash, blockNumber: receipt.blockNumber };
  };

  /* ----- staking ----- */

  // TempleGoldStaking and TempleGold, when configured on the Granary's chain
  const stakingOn = isDeployed(staking) && staking?.chainId === config.chainId;
  const stakingC = stakingOn
    ? (TempleGoldStaking__factory.connect(
        (staking as ContractConfig<Contract>).address,
        provider
      ) as TempleGoldStaking)
    : undefined;
  const tgldC =
    isDeployed(templeGold) && templeGold?.chainId === config.chainId
      ? (TempleGold__factory.connect(
          (templeGold as ContractConfig<Contract>).address,
          provider
        ) as TempleGold)
      : undefined;
  const stakingContract = () => {
    if (!stakingC) throw new GranaryError('NotDeployed');
    return stakingC;
  };
  // the staking token (TEMPLE), read once
  let stakingToken: Promise<string> | undefined;
  const stakingTokenAddress = () => {
    if (!stakingToken) {
      stakingToken = stakingContract().stakingToken();
      stakingToken.catch(() => (stakingToken = undefined));
    }
    return stakingToken;
  };

  // Wishes made this session, for the "new" chip.
  const madeThisSession = new Set<string>();
  const wishKey = (account: string, give: Token, get: Token) =>
    `${account}:${pairIdOf(give, get)}`.toLowerCase();

  const wishToken = (symbol: Token) =>
    wishTokens.find((t) => t.symbol === symbol);

  return {
    async getIndexerStatus(): Promise<IndexerStatus> {
      if (!indexer)
        return {
          blockNumber: 0,
          blockTime: new Date(),
          hasIndexingErrors: false,
        };
      const m = await pinned();
      return {
        blockNumber: m.block.number,
        blockTime: toDate(m.block.timestamp),
        hasIndexingErrors: m.hasIndexingErrors,
      };
    },

    async getAuctions() {
      if (!indexer) return [];
      const N = (await pinned()).block.number;
      return (await indexer.auctions(N))
        .map(toAuction)
        .filter((a): a is Auction => !!a);
    },

    // Every pair with an auction or a wish, with its wish demand.
    async getPairs() {
      if (!indexer) return [];
      const m = await pinned();
      const N = m.block.number;
      const [pairs, wishes, positions] = await Promise.all([
        indexer.pairs(N),
        indexer.wishes(N),
        indexer.demandPositions(N),
      ]);
      const demand = demandByPair(
        wishes,
        positions,
        m.block.timestamp,
        tokenOf
      );
      const out = new Map<string, Pair>();
      const add = (bidAddr: string, fillAddr: string) => {
        const bid = tokenOf(bidAddr);
        const fill = tokenOf(fillAddr);
        if (!bid || !fill) return;
        const id = pairIdOf(bid.symbol, fill.symbol);
        if (out.has(id)) return;
        out.set(id, {
          id,
          bidToken: bid.symbol,
          fillToken: fill.symbol,
          // hidden while the indexer reports errors (docs: suppress demand)
          wishedFor: m.hasIndexingErrors
            ? undefined
            : demand.get(`${bidAddr}${fillAddr.slice(2)}`.toLowerCase()) ??
              ZERO,
        });
      };
      pairs.forEach((p) => add(p.bidToken.id, p.fillToken.id));
      wishes.forEach((w) => add(w.fromToken, w.toToken));
      return Array.from(out.values());
    },

    async getWishTokens() {
      return wellDeployed ? wishTokens.map((t) => t.symbol) : [];
    },

    async getPositions(account) {
      if (!indexer) return [];
      const N = (await pinned()).block.number;
      return (await indexer.myPositions(N, account.toLowerCase()))
        .map(toPosition)
        .filter(
          (p): p is Position =>
            !!p &&
            (isPositive(p.deposit) || isPositive(p.excluded) || p.claimed)
        );
    },

    async getWishes(account) {
      if (!indexer || !wellDeployed) return [];
      const N = (await pinned()).block.number;
      const rows = await indexer.myWishes(N, account.toLowerCase());
      return rows.flatMap((w): Wish[] => {
        const give = tokenOf(w.fromToken);
        const get = tokenOf(w.toToken);
        if (!give || !get) return [];
        return [
          {
            give: give.symbol,
            get: get.symbol,
            amount: fromUnits(w.fromAmount, give.decimals),
            expiresAt: toDate(w.expiresAt),
            isNew: madeThisSession.has(
              wishKey(account, give.symbol, get.symbol)
            ),
          },
        ];
      });
    },

    /* ----- contract reads ----- */

    async getClaimable(account, a) {
      const fpa = auctionAt(a.id);
      const [t, c, deposit] = await Promise.all([
        termsOf(a),
        fpa.claimable(account),
        fpa.deposits(account),
      ]);
      if (c.fill.isZero() && c.refund.isZero()) return null;
      return {
        filledBid: fromUnits(deposit.sub(c.refund), t.bid.decimals),
        fill: fromUnits(c.fill, t.fill.decimals),
        refund: fromUnits(c.refund, t.bid.decimals),
      };
    },

    async getBalances(account) {
      const out: Balances = {};
      await Promise.all(
        Array.from(inUse.values()).map(async (t) => {
          try {
            const v = await ERC20__factory.connect(
              t.address,
              provider
            ).balanceOf(account);
            out[t.symbol] = fromUnits(v, t.decimals);
          } catch (err) {
            console.warn(`Granary: balanceOf failed for ${t.symbol}`, err);
          }
        })
      );
      return out;
    },

    async getStaking(account): Promise<StakingSummary> {
      const empty: StakingSummary = {
        totalStaked: ZERO,
        circulatingTgld: ZERO,
        weeklyRewards: ZERO,
        cooldownDays: 0,
        paused: false,
        staked: ZERO,
        available: ZERO,
        rewards: ZERO,
        dailyReward: ZERO,
      };
      if (!stakingC) return empty;
      const s = stakingC;
      const [total, rewardData, cooldown, paused, circulating] =
        await Promise.all([
          s.totalSupply(),
          s.getRewardData(),
          s.unstakeCooldown(),
          s.paused(),
          tgldC?.circulatingSupply() ?? constants.Zero,
        ]);
      // rewards accrue at rewardRate (TGLD/s) until periodFinish
      const live = rewardData.periodFinish > Date.now() / 1000;
      const perSecond = live ? fromUnits(rewardData.rewardRate, 18) : ZERO;
      const totalStaked = fromUnits(total, 18);
      const pool = {
        ...empty,
        totalStaked,
        circulatingTgld: fromUnits(circulating, 18),
        weeklyRewards: roundTo(perSecond.mul(whole(7 * 86_400)), 18),
        cooldownDays: Number(cooldown) / 86_400,
        paused,
      };
      if (!account) return pool;
      const token = ERC20__factory.connect(
        await stakingTokenAddress(),
        provider
      );
      const [staked, earned, available, unstakeAt, delegatee] =
        await Promise.all([
          s.balanceOf(account),
          s.earned(account),
          token.balanceOf(account),
          s.getAccountUnstakeTime(account),
          s.delegates(account),
        ]);
      const mine = fromUnits(staked, 18);
      return {
        ...pool,
        staked: mine,
        available: fromUnits(available, 18),
        rewards: fromUnits(earned, 18),
        dailyReward: totalStaked.isZero()
          ? ZERO
          : perSecond.mul(whole(86_400)).mul(mine).div(totalStaked, 18),
        unstakeAt: unstakeAt.isZero() ? undefined : toDate(unstakeAt),
        delegate: delegatee === constants.AddressZero ? undefined : delegatee,
      };
    },

    async getFlaggedLists(account, lists) {
      const flagged = await Promise.all(
        lists.map(async (list) => {
          try {
            return (await IComplianceCheck__factory.connect(
              list,
              provider
            ).isFlagged(account))
              ? list
              : null;
          } catch (err) {
            // a reverted read counts as flagged; a network error is retried
            if ((err as { code?: string })?.code === 'CALL_EXCEPTION')
              return list;
            throw err;
          }
        })
      );
      return flagged.filter((l): l is string => !!l);
    },

    /* ----- writes ----- */

    async deposit(account, a, amount) {
      const { bid } = await termsOf(a);
      const v = parseAmount(amount, bid.decimals);
      return send(async (signer) => {
        await getWallet().ensureAllowance(
          bid.symbol,
          bid.address,
          a.id,
          v,
          signer
        );
        return auctionAt(a.id).connect(signer).populateTransaction.deposit(v);
      });
    },

    async withdrawDeposit(account, a, amount) {
      const { bid } = await termsOf(a);
      const v =
        amount === 'all'
          ? await auctionAt(a.id).deposits(account)
          : parseAmount(amount, bid.decimals);
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
      const g = wishToken(give);
      const r = wishToken(get);
      if (!g || !r || g === r) throw new GranaryError('InvalidAmount');
      const v = parseAmount(amount, g.decimals);
      // the expiry is set from the wall clock (indexer docs, render rules)
      const expiresAt = Math.floor(Date.now() / 1000 + durationDays * 86_400);
      const receipt = await send((signer) =>
        well
          .connect(signer)
          .populateTransaction.wish(g.address, r.address, v, expiresAt)
      );
      madeThisSession.add(wishKey(account, give, get));
      return receipt;
    },

    async revokeWish(account, w) {
      if (!wellDeployed) throw new GranaryError('NotDeployed');
      const g = tokenOf(
        Array.from(known.values()).find((t) => t.symbol === w.give)?.address ??
          ''
      );
      const r = tokenOf(
        Array.from(known.values()).find((t) => t.symbol === w.get)?.address ??
          ''
      );
      if (!g || !r) throw new GranaryError('InvalidAmount');
      const receipt = await send((signer) =>
        well
          .connect(signer)
          .populateTransaction.wish(g.address, r.address, 0, 0)
      );
      madeThisSession.delete(wishKey(account, w.give, w.get));
      return receipt;
    },

    async stake(account, amount) {
      const s = stakingContract();
      const v = parseAmount(amount, 18);
      const temple = await stakingTokenAddress();
      return send(
        async (signer) => {
          await getWallet().ensureAllowance(
            'TEMPLE',
            temple,
            s.address,
            v,
            signer
          );
          return s.connect(signer).populateTransaction.stake(v);
        },
        { indexed: false }
      );
    },

    async unstake(account, amount, claimRewards) {
      const s = stakingContract();
      const v = parseAmount(amount, 18);
      return send(
        (signer) =>
          s.connect(signer).populateTransaction.withdraw(v, claimRewards),
        { indexed: false }
      );
    },

    async claimStakingRewards(account) {
      const s = stakingContract();
      return send(
        (signer) => s.connect(signer).populateTransaction.getReward(account),
        { indexed: false }
      );
    },

    async delegate(account, delegatee) {
      const s = stakingContract();
      if (!utils.isAddress(delegatee.trim()))
        throw new GranaryError('InvalidAddress');
      const to = utils.getAddress(delegatee.trim());
      return send(
        (signer) => s.connect(signer).populateTransaction.delegate(to),
        { indexed: false }
      );
    },
  };
};
