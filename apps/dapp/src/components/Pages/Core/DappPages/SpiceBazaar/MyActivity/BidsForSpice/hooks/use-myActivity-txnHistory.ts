import { useCallback, useEffect, useState } from 'react';
import {
  userTransactionsSpiceAuctions,
  cachedSubgraphQuery,
} from 'utils/subgraph';
import type { Transaction } from '../DataTables/TransactionsDataTable';
import { useWallet } from 'providers/WalletProvider';
import { getAllSpiceBazaarSubgraphEndpoints } from 'constants/env/getSpiceBazaarEndpoints';

type UseMyActivityTxnHistoryReturn = {
  data: Transaction[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export const useMyActivityTxnHistory = (): UseMyActivityTxnHistoryReturn => {
  const [data, setData] = useState<Transaction[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
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

      const responses = await Promise.all(
        getAllSpiceBazaarSubgraphEndpoints().map((entry) =>
          cachedSubgraphQuery(
            entry.url,
            userTransactionsSpiceAuctions(wallet)
          ).then((res) => ({
            data: res,
            label: entry.label,
          }))
        )
      );

      const allPositions = responses.flatMap(({ data, label }) =>
        (data?.user?.positions || []).map((position) => ({
          ...position,
          _subgraphLabel: label,
        }))
      );

      const parsedData = allPositions.flatMap((position) =>
        (position.transactions || []).map((transaction: any) => {
          const isBid = 'bidAmount' in transaction;
          const isClaim = 'auctionAmount' in transaction;

          return {
            epoch: transaction.timestamp,
            type: isBid ? 'Bid' : isClaim ? 'Claim' : 'Unknown',
            transactionLink: shortenTxnHash(transaction.hash),
            transactionHash: transaction.hash,
            name: position.auctionInstance?.spiceAuction?.name || '-',
          };
        })
      );

      setData(parsedData);
    } catch (err) {
      console.error('Failed to fetch txn history', err);
      setError('Failed to fetch txn history.');
    } finally {
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
