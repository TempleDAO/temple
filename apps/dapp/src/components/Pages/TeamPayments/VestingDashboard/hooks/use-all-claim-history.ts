import { useMemo } from 'react';
import { getAppConfig } from 'constants/newenv';
import { allReleaseTransactions, useCachedSubgraphQuery } from 'utils/subgraph';
import env from 'constants/env';

export type ClaimTransaction = {
  grantDate: string;
  claimedTgld: string;
  granteeAddress: string;
  transactionLink: string;
  transactionHash: string;
  displayHash: string;
};

type UseAllClaimHistoryReturn = {
  transactions: ClaimTransaction[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

const shortenAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const shortenHash = (hash: string): string => {
  if (!hash || hash.length < 10) return hash;
  return `${hash.slice(0, 16)}...${hash.slice(-6)}`;
};

export const useAllClaimHistory = (
  walletAddress?: string
): UseAllClaimHistoryReturn => {
  const subgraphUrl = getAppConfig().vesting.subgraphUrl;

  const {
    data: response,
    isLoading: loading,
    error,
    refetch,
  } = useCachedSubgraphQuery(subgraphUrl, allReleaseTransactions());

  const transactions = useMemo((): ClaimTransaction[] => {
    if (!response?.releaseTransactions) {
      return [];
    }

    // Filter by wallet address if provided (treat empty string as no filter)
    let filteredTransactions = response.releaseTransactions;
    if (walletAddress?.trim()) {
      const normalizedAddress = walletAddress.toLowerCase();
      filteredTransactions = filteredTransactions.filter(
        (tx) => tx.user.id.toLowerCase() === normalizedAddress
      );
    }

    return filteredTransactions.map((tx) => {
      const txLink = `${env.etherscan}/tx/${tx.hash}`;

      return {
        grantDate: tx.timestamp, // Keep as timestamp for sorting
        claimedTgld: parseFloat(tx.releasedAmount).toLocaleString(),
        granteeAddress: shortenAddress(tx.user.id),
        transactionLink: txLink,
        transactionHash: tx.hash,
        displayHash: shortenHash(tx.hash),
      };
    });
  }, [response, walletAddress]);

  return {
    transactions,
    loading,
    error: error ? 'Failed to fetch claim history.' : null,
    refetch,
  };
};
