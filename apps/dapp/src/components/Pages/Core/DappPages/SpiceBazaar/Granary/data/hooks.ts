import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';
import {
  AUCTIONS,
  FIXED_NOW,
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

const NowContext = createContext(FIXED_NOW);
// Inject a different clock with <NowProvider value={date}>.
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

export const usePairs = () => query(PAIRS);

export const usePair = (pairId: string) =>
  query(PAIRS.find((p) => p.id === pairId));

export const useAuctions = () => query(AUCTIONS);

// One pair's auctions, newest first.
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

export const useMyPositions = () => query(useAccount().positions);

export const useMyWishes = () => query(useAccount().wishes);

/* ---------- contract reads ---------- */

export const useWalletBalance = (token: Token) => query(WALLET[token] ?? 0);

export const useStaking = () => query(STAKING);

// claimable(account) for one auction; null when nothing is owed.
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

// wish() replaces any earlier wish for the same pair.
export const useWishActions = () => ({
  makeWish: async (w: Wish) => {
    await wallet();
    update((s) => ({
      ...s,
      wishes: [
        {
          ...w,
          isNew: !s.wishes.some((x) => x.from === w.from && x.to === w.to),
        },
        ...s.wishes.filter((x) => x.from !== w.from || x.to !== w.to),
      ],
    }));
  },
});
