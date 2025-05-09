import { useState, useEffect, useCallback } from 'react';
import { bidsHistoryGoldAuction, subgraphQuery } from 'utils/subgraph';
import env from 'constants/env';
import { DaiGoldAuctionInfo } from 'providers/SpiceBazaarProvider';

export type Bid = {
  date: string;
  bidAmount: string;
  price: string;
  transaction: string;
  transactionHash: string;
};

type UseBidsHistoryReturn = {
  data: Bid[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export const useBidsHistory = (
  auctionInfo: DaiGoldAuctionInfo
): UseBidsHistoryReturn => {
  const [data, setData] = useState<Bid[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const shortenTxnHash = (hash: string) => {
    if (!hash || hash.length < 16) return hash;
    return `${hash.slice(0, 16)}...${hash.slice(-8)}`;
  };

  const daiGoldAuction = env.contracts.spiceBazaar.daiGoldAuction.toLowerCase();
  const epoch = auctionInfo.currentEpoch.toString();
  const auctionId = `${daiGoldAuction}-${epoch}`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await subgraphQuery(
        env.subgraph.spiceBazaar,
        bidsHistoryGoldAuction(auctionId)
      );
      setData(
        response.stableGoldAuctionInstance.bidTransaction.map((r) => ({
          date: r.timestamp,
          bidAmount: r.bidAmount,
          price: r.price,
          transaction: shortenTxnHash(r.hash),
          transactionHash: r.hash,
        }))
      );
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch transaction history.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
};
