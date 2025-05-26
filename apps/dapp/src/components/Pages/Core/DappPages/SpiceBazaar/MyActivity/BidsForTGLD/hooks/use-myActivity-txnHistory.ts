import { useState, useEffect, useCallback } from 'react';
import {
  userTransactionsDAIGoldAuctions,
  subgraphQuery,
  cachedSubgraphQuery,
} from 'utils/subgraph';
import type { Transaction } from '../DataTables/TransactionsDataTable';
import { useWallet } from 'providers/WalletProvider';
import env from 'constants/env';

type UseMyActivityTxnHistoryReturn = {
  data: Transaction[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export const useMyActivityTxnHistory = (): UseMyActivityTxnHistoryReturn => {
  const [data, setData] = useState<Transaction[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { wallet } = useWallet();

  const shortenTxnHash = (hash: string) => {
    if (!hash || hash.length < 16) return hash;
    return `${hash.slice(0, 16)}...${hash.slice(-8)}`;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (!wallet) {
        setData([]);
        setLoading(false);
        return;
      }

      const response = await cachedSubgraphQuery(
        env.subgraph.spiceBazaar.eth, // stable/gold auctions only on eth network
        userTransactionsDAIGoldAuctions(wallet)
      );

      const parsedData = response?.user?.positions
        ?.flatMap((position) => position.transactions)
        ?.map((transaction) => {
          const isBid = 'bidAmount' in transaction;
          const isClaim = 'auctionAmount' in transaction;

          return {
            id: transaction.id,
            epoch: transaction.timestamp,
            type: isBid ? 'Bid' : isClaim ? 'Claim' : 'Unknown',
            transactionLink: shortenTxnHash(transaction.hash),
            transactionHash: transaction.hash,
          };
        });

      setData(parsedData);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch transaction history.');
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    fetchData();
  }, [wallet, fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
};
