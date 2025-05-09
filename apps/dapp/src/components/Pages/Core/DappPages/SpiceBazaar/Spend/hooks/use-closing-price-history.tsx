import { useCallback, useEffect, useState } from 'react';
import { spiceAuction } from 'utils/subgraph';
import { subgraphQuery } from 'utils/subgraph';
import env from 'constants/env';

export type Metric = {
  id: string;
  date: string;
  value: number;
  timestamp: number;
};

type UseClosingPriceHistoryReturn = {
  data: Metric[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export const useClosingPriceHistory = (
  auctionAddress: string
): UseClosingPriceHistoryReturn => {
  const [data, setData] = useState<Metric[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await subgraphQuery(
        env.subgraph.spiceBazaar,
        spiceAuction(auctionAddress)
      );

      const rawInstances = response?.spiceAuction?.auctionInstances ?? [];

      const metrics: Metric[] = rawInstances
        .map((instance: any) => ({
          id: instance.id,
          timestamp: Number(instance.timestamp),
          date: new Date(Number(instance.timestamp) * 1000).toLocaleDateString(
            'en-GB',
            {
              month: 'short',
              day: 'numeric',
            }
          ),
          value: parseFloat(instance.priceRatio),
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

      setData(metrics);
    } catch (err) {
      console.error('Failed to fetch spice auction subgraph data', err);
      setError('Failed to load spice auction subgraph data.');
    } finally {
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
