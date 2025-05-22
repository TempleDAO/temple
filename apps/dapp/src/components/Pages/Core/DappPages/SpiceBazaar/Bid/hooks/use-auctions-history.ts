import { useState, useEffect } from 'react';
import { stableGoldAuctionInstances, subgraphQuery } from 'utils/subgraph';
import env from 'constants/env';

export type Transaction = {
  epoch: string;
  status: 'Upcoming' | 'Active' | 'Closed';
  startTime: string;
  endTime: string;
  totalAuctionTokenAmount: string;
  priceRatio: string;
};

type UseAuctionsHistoryReturn = {
  data: Transaction[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export const useAuctionsHistory = (): UseAuctionsHistoryReturn => {
  const [data, setData] = useState<Transaction[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const getAuctionStatus = (
    startTime: string,
    endTime: string
  ): 'Upcoming' | 'Active' | 'Closed' => {
    const now = new Date().getTime().toString();

    if (startTime > now) {
      return 'Upcoming';
    } else if (endTime > now) {
      return 'Active';
    } else {
      return 'Closed';
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await subgraphQuery(
        env.subgraph.spiceBazaar,
        stableGoldAuctionInstances()
      );

      setData(
        response.stableGoldAuctionInstances.map((r) => ({
          epoch: r.epoch,
          startTime: r.startTime,
          endTime: r.endTime,
          totalAuctionTokenAmount: parseFloat(
            r.totalAuctionTokenAmount
          ).toFixed(2),
          priceRatio: parseFloat(r.priceRatio).toFixed(5),
          status: getAuctionStatus(r.startTime, r.endTime),
        }))
      );
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch auction history.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
};
