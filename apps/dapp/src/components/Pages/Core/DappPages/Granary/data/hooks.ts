import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { granaryKeys, useGranary } from 'providers/GranaryProvider';
import { isPositive, pairIdOf, ZERO } from './derive';
import type { Auction, Token } from './types';

// Every screen reads Granary data through these hooks. Each returns
// { data, isLoading }; data falls back to an empty value while loading.

/* ---------- clock ---------- */

const TICK_MS = 30_000;
const NowContext = createContext<Date | null>(null);
const WallClockContext = createContext<Date | null>(null);
// Inject clocks with these (stories, tests).
export const NowProvider = NowContext.Provider;
export const WallClockProvider = WallClockContext.Provider;

// The wall clock, updated every 30s.
export const useTickingNow = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now;
};

// The indexer's block time: phases, countdowns and everything else derived
// from indexed data use it, so they agree with that data (indexer docs,
// render rules).
export const useNow = () => {
  const now = useContext(NowContext);
  if (!now) throw new Error('useNow must be used inside NowProvider');
  return now;
};

// The wall clock: only for freshness labels, chart "today" and wish expiry
// dates, which the wish transaction sets from the wall clock.
export const useWallClock = () => {
  const now = useContext(WallClockContext);
  if (!now)
    throw new Error('useWallClock must be used inside WallClockProvider');
  return now;
};

/* ---------- indexer reads ---------- */

export const usePairs = () => useGranary().pairs;

export const usePair = (pairId: string) => {
  const { data, ...rest } = useGranary().pairs;
  return { ...rest, data: data.find((p) => p.id === pairId) };
};

export const useAuctions = () => useGranary().auctions;

// Tokens the wish screen offers.
export const useWishTokens = () => useGranary().wishTokens;

// The block the data was read at: freshness labels and the block wish demand
// is counted at.
export const useIndexerStatus = () => useGranary().indexerStatus;

// One pair's auctions, newest first.
export const usePairAuctions = (pairId: string) => {
  const { data, ...rest } = useGranary().auctions;
  const filtered = useMemo(
    () =>
      data
        .filter((a) => pairIdOf(a.bidToken, a.fillToken) === pairId)
        .sort((a, b) => b.number - a.number),
    [data, pairId]
  );
  return { ...rest, data: filtered };
};

export const useMyPositions = () => useGranary().positions;

export const useMyWishes = () => useGranary().wishes;

/* ---------- contract reads ---------- */

export const useWalletBalance = (token: Token) => {
  const { data, ...rest } = useGranary().balances;
  return { ...rest, data: data[token] ?? ZERO };
};

export const useStaking = () => useGranary().staking;

// claimable(account) for one auction; null when nothing is owed.
export const useClaimable = (auction?: Auction) => {
  const { source, account, positions } = useGranary();
  const pos = positions.data.find((p) => p.auction === auction?.id);
  const owes = !!auction && !!pos && !pos.claimed && isPositive(pos.deposit);
  const q = useQuery({
    queryKey: granaryKeys.claimable(account, auction?.id ?? ''),
    queryFn: () => source.getClaimable(account as string, auction as Auction),
    enabled: !!account && owes,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  return {
    data: owes ? q.data ?? null : null,
    isLoading: q.isInitialLoading,
  };
};

// Whether the connected account is blocked by this auction's compliance list.
export const useIsFlagged = (auction?: Auction) => {
  const lists = useGranary().flaggedLists.data;
  return (
    !!auction?.complianceCheck && !!lists?.includes(auction.complianceCheck)
  );
};

// Whether the account's compliance result for this auction is still missing:
// 'checking' while it loads, 'failed' if the read failed. Deposits wait for
// it, so a flagged account doesn't pay for an approval first.
export const useComplianceWait = (auction?: Auction) => {
  const { account, flaggedLists } = useGranary();
  if (!account || !auction?.complianceCheck || flaggedLists.data) return null;
  return flaggedLists.isError ? 'failed' : 'checking';
};

/* ---------- writes ---------- */

export const useAuctionActions = () => {
  const { deposit, withdrawDeposit, claim, withdrawExcluded } =
    useGranary().actions;
  return { deposit, withdrawDeposit, claim, withdrawExcluded };
};

export const useStakingActions = () => {
  const { stake, unstake, claimStakingRewards, delegate } =
    useGranary().actions;
  return { stake, unstake, claimStakingRewards, delegate };
};

export const useWishActions = () => {
  const { setWish, revokeWish } = useGranary().actions;
  return { setWish, revokeWish };
};

// The connected account, and a prompt to connect one.
export const useGranaryWallet = () => {
  const { account, connect } = useGranary();
  return { account, connect };
};
