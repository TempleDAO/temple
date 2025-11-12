import { useMemo } from 'react';
import { useWallet } from 'providers/WalletProvider';
import { getAppConfig } from 'constants/newenv';
import {
  userReleaseTransactions,
  useCachedSubgraphQuery,
} from 'utils/subgraph';
import type { Transaction } from '../DataTables/ClaimHistoryDataTable';

// --- Constants ---
const HASH_PREFIX_LENGTH = 16;
const HASH_SUFFIX_LENGTH = 8;
const DEFAULT_LOCALE = 'en-US';

type UseClaimHistoryReturn = {
  data: Transaction[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

// --- Pure helpers (no side-effects) ----
function shortenTxnHash(hash: string): string {
  if (!hash || hash.length < HASH_PREFIX_LENGTH + HASH_SUFFIX_LENGTH)
    return hash;
  return `${hash.slice(0, HASH_PREFIX_LENGTH)}...${hash.slice(
    -HASH_SUFFIX_LENGTH
  )}`;
}

function formatDate(tsSec: string | number, locale = DEFAULT_LOCALE): string {
  const n = typeof tsSec === 'string' ? Number(tsSec) : tsSec;
  if (!Number.isFinite(n)) return '-';
  return new Date(n * 1000).toLocaleDateString(locale, {
    month: 'short',
    year: 'numeric',
  });
}

function toNumber(value: string | undefined | null): number {
  if (!value) return 0;
  const v = value.trim();
  try {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function isValidReleaseTransaction(tx: any): tx is {
  id: string;
  timestamp: string;
  name: string;
  hash: string;
  releasedAmount: string;
  schedule: { start: string };
} {
  return !!(
    tx &&
    typeof tx.id === 'string' &&
    tx.id.length > 0 &&
    typeof tx.timestamp === 'string' &&
    tx.timestamp.length > 0 &&
    typeof tx.name === 'string' &&
    tx.name.length > 0 &&
    typeof tx.hash === 'string' &&
    tx.hash.length > 0 &&
    typeof tx.releasedAmount === 'string' &&
    tx.releasedAmount.length > 0 &&
    tx.schedule &&
    typeof tx.schedule.start === 'string' &&
    tx.schedule.start.length > 0
  );
}

/**
 * Custom hook to fetch and manage user claim history
 * Fetches release transactions from the vesting subgraph
 *
 * @returns Claim history transactions, loading state, and refetch function
 */
export const useClaimHistory = (): UseClaimHistoryReturn => {
  const { wallet } = useWallet();
  const subgraphUrl = getAppConfig().vesting.subgraphUrl;

  const normalizedWallet = wallet?.toLowerCase() || '';

  const {
    data: response,
    isLoading: loading,
    error,
    refetch,
  } = useCachedSubgraphQuery(
    subgraphUrl,
    userReleaseTransactions(normalizedWallet),
    [normalizedWallet],
    { enabled: Boolean(wallet) }
  );

  const data = useMemo((): Transaction[] | null => {
    if (!wallet) {
      return null; // null = unknown/not loaded
    }

    // Early exit for no transactions
    if (!response?.user?.transactions?.length) {
      return []; // [] = loaded/empty
    }

    // Filter, map, and sort transactions (newest first for stable UI)
    const transactions: Transaction[] = response.user.transactions
      .filter(isValidReleaseTransaction)
      .map((tx) => {
        const amount = toNumber(tx.releasedAmount);
        return {
          grantDate: formatDate(tx.schedule.start),
          claimedTgld: amount.toLocaleString(DEFAULT_LOCALE),
          transactionLink: shortenTxnHash(tx.hash),
          transactionHash: tx.hash,
        };
      })
      .sort((a, b) => {
        // Sort by grant date descending (newest first)
        return (
          new Date(b.grantDate).getTime() - new Date(a.grantDate).getTime()
        );
      });

    return transactions;
  }, [wallet, response]);

  return {
    data,
    loading: wallet ? loading : false,
    error: error ? 'Failed to fetch claim history.' : null,
    refetch: () => refetch(),
  };
};
