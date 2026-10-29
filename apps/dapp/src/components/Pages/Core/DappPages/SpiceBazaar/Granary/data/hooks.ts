import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';
import {
  AUCTIONS,
  FIXED_NOW,
  INDEXER_STATUS,
  PAIRS,
  POSITIONS,
  STAKING,
  WALLET,
  WISHES,
} from './fixtures';
import { pairIdOf, settlementFor } from './derive';
import type { Auction, Token, Wish } from './types';

// Every screen reads data through these hooks only. Each is shaped like the
// indexer query or contract read that will replace it ({ data, isLoading }).
// Spec: spec/indexer-implementation-spec.md at the repo root. §7 has the
// GraphQL operations, §6 the render-time rules, §11 the full hook mapping and
// what must change when wiring (bigint amounts, Token objects, address ids).

const NowContext = createContext(FIXED_NOW);
// Inject a different clock with <NowProvider value={date}>.
// Wired: phase, deadlines and claims use T from Meta, not the wall clock (§6.1).
export const NowProvider = NowContext.Provider;
export const useNow = () => useContext(NowContext);

// In-memory account state so simulated transactions show up across screens.
type AccountState = { positions: typeof POSITIONS; wishes: Wish[] };
let state: AccountState = { positions: POSITIONS, wishes: WISHES };
const listeners = new Set<() => void>();
const update = (fn: (s: AccountState) => AccountState) => {
  state = fn(state);
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const useAccount = () => useSyncExternalStore(subscribe, () => state);

const query = <T>(data: T) => ({ data, isLoading: false });

/* ---------- indexer reads ---------- */

// AllAuctions.pairs (§7.1) + demand computed at a pinned block (§6.5, §7.6).
export const usePairs = () => query(PAIRS);

// PairPage.pair (§7.2); PairHistory.pair on the history page (§7.3).
export const usePair = (pairId: string) =>
  query(PAIRS.find((p) => p.id === pairId));

// AllAuctions.running + chart (§7.1); also EarnTgld (§7.4), MyActivity.running (§7.5).
export const useAuctions = () => query(AUCTIONS);

// Latest indexed block: freshness labels and the block wish demand is counted at.
// Meta: _meta.block { number timestamp } → N, T for every other query (§7).
export const useIndexerStatus = () => query(INDEXER_STATUS);

// One pair's auctions, newest first.
// PairPage.recent + running + selected (§7.2); history pages via PairHistory, number_lt cursor (§7.3).
export const usePairAuctions = (pairId: string) =>
  query(
    useMemo(
      () =>
        AUCTIONS.filter(
          (a) => pairIdOf(a.bidToken, a.fillToken) === pairId
        ).sort((a, b) => b.number - a.number),
      [pairId]
    )
  );

// MyActivity.positions (§7.5); per screen: AllAuctions.mine, PairPage.mine, EarnTgld.mine.
export const useMyPositions = () => query(useAccount().positions);

// MyActivity.wishes (§7.5); PairPage.myWish for one pair (§7.2).
export const useMyWishes = () => query(useAccount().wishes);

/* ---------- contract reads ---------- */

// ERC-20 balanceOf(me) (§7.7).
export const useWalletBalance = (token: Token) => query(WALLET[token] ?? 0);

// Existing staking reads; out of the indexer's scope.
export const useStaking = () => query(STAKING);

// claimable(account) for one auction; null when nothing is owed.
// Wired: display the §6.4 estimate from indexed fields; read claimable(me) on press (§7.7).
export const useClaimable = (auction?: Auction) => {
  const now = useNow();
  const pos = useAccount().positions.find((p) => p.auction === auction?.id);
  return query(
    auction && pos && !pos.claimed && pos.deposit > 0
      ? settlementFor(auction, pos.deposit, now)
      : null
  );
};

/* ---------- simulated writes ---------- */

const wallet = () => new Promise((r) => setTimeout(r, 900));

const setPosition = (
  auction: string,
  fn: (p: { deposit: number; claimed: boolean }) => {
    deposit: number;
    claimed: boolean;
  }
) =>
  update((s) => {
    const cur = s.positions.find((p) => p.auction === auction) ?? {
      auction,
      deposit: 0,
      claimed: false,
    };
    return {
      ...s,
      positions: [
        ...s.positions.filter((p) => p.auction !== auction),
        { ...cur, ...fn(cur) },
      ],
    };
  });

// deposit / withdrawDeposit / claim txs, then poll _meta until ≥ the receipt block (§7).
export const useAuctionActions = () => ({
  deposit: async (a: Auction, amount: number) => {
    await wallet();
    setPosition(a.id, (p) => ({ ...p, deposit: p.deposit + amount }));
  },
  withdraw: async (a: Auction) => {
    await wallet();
    setPosition(a.id, (p) => ({ ...p, deposit: 0 }));
  },
  claim: async (a: Auction) => {
    await wallet();
    setPosition(a.id, (p) => ({ ...p, claimed: true }));
  },
});

// WishingWell.wish(from, to, amount, expiry), then the same _meta poll.
// wish() replaces any earlier wish for the same pair.
export const useWishActions = () => ({
  makeWish: async (w: Wish) => {
    await wallet();
    putWish({ ...w, isNew: true });
  },
  // Same wish() call with a later expiry; keeps the row's "new" tag as it was.
  extendWish: async (w: Wish, expiry: Date) => {
    await wallet();
    putWish({ ...w, expiry });
  },
});

const putWish = (w: Wish) =>
  update((s) => ({
    ...s,
    wishes: [w, ...s.wishes.filter((x) => x.from !== w.from || x.to !== w.to)],
  }));
