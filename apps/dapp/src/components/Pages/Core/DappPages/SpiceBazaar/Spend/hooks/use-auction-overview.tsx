import { useCallback, useEffect, useState } from 'react';
import { spiceAuction, subgraphQuery } from 'utils/subgraph';
import { getAllSpiceBazaarSubgraphEndpoints } from 'constants/env/getSpiceBazaarEndpoints';

export type AuctionOverviewMetric = {
  epoch: string;
  date: string;
  totalBidAmount: number;
  totalOfferedAmount: number;
};

type UseAuctionOverviewReturn = {
  data: AuctionOverviewMetric[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export const useAuctionOverview = (
  auctionAddress: string
): UseAuctionOverviewReturn => {
  const [data, setData] = useState<AuctionOverviewMetric[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const endpoints = getAllSpiceBazaarSubgraphEndpoints();

      let spiceAuctionData = null;

      for (const entry of endpoints) {
        try {
          const response = await subgraphQuery(
            entry.url,
            spiceAuction(auctionAddress)
          );
          if (response.spiceAuction) {
            spiceAuctionData = response.spiceAuction;
            break;
          }
        } catch (err) {
          console.warn(`subgraphQuery failed for endpoint ${entry.url}`, err);
        }
      }

      if (!spiceAuctionData) {
        console.warn('No spiceAuction found in any subgraph');
        setData([]);
        return;
      }

      const rawInstances = spiceAuctionData.auctionInstances ?? [];

      const metrics: AuctionOverviewMetric[] = rawInstances
        .map((instance: any) => ({
          epoch: instance.epoch,
          date: new Date(Number(instance.endTime) * 1000).toLocaleDateString(
            'en-GB',
            { day: 'numeric', month: 'short', year: 'numeric' }
          ),
          totalBidAmount: parseFloat(instance.totalBidTokenAmount),
          totalOfferedAmount: parseFloat(instance.totalAuctionTokenAmount),
        }))
        .sort(
          (a: AuctionOverviewMetric, b: AuctionOverviewMetric) =>
            Number(a.epoch) - Number(b.epoch)
        );

      setData(metrics);
    } catch (err) {
      console.error('Failed to fetch auction overview data', err);
      setError('Failed to load auction overview data.');
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
