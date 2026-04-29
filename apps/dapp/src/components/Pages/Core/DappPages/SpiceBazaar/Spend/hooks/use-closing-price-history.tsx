import { useCallback, useEffect, useState } from 'react';
import { spiceAuction, subgraphQuery } from 'utils/subgraph';
import { getAllSpiceBazaarSubgraphEndpoints } from 'constants/env/getSpiceBazaarEndpoints';

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
      const endpoints = getAllSpiceBazaarSubgraphEndpoints();

      let spiceAuctionData = null;

      for (const entry of endpoints) {
        const response = await subgraphQuery(
          entry.url,
          spiceAuction(auctionAddress)
        );
        if (response.spiceAuction) {
          spiceAuctionData = response.spiceAuction;
          break;
        }
      }

      if (!spiceAuctionData) {
        console.warn('No spiceAuction found in any subgraph');
        setData([]);
        return;
      }

      const rawInstances = spiceAuctionData.auctionInstances ?? [];

      const metrics: Metric[] = rawInstances
        .map((instance: any) => ({
          id: instance.id,
          timestamp: Number(instance.timestamp),
          date: new Date(Number(instance.endTime) * 1000).toLocaleDateString(
            'en-GB',
            {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }
          ),
          value: parseFloat(instance.priceRatio),
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

      setData(metrics);
    } catch (err) {
      console.error('Failed to fetch spice auction subgraph data', err);
      setError('Failed to load spice auction subgraph data.');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [auctionAddress]);

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
