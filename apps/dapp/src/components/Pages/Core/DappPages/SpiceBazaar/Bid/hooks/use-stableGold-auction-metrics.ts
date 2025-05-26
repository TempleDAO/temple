import { useCallback, useEffect, useState } from 'react';
import { stableGoldAuction } from 'utils/subgraph';
import { subgraphQuery } from 'utils/subgraph';
import env from 'constants/env';

export type Metric = {
  id: string;
  date: string;
  value: number;
  timestamp: number;
};

type UseStableGoldAuctionMetricsReturn = {
  data: Metric[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export const useStableGoldAuctionMetrics =
  (): UseStableGoldAuctionMetricsReturn => {
    const [data, setData] = useState<Metric[] | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await subgraphQuery(
          env.subgraph.spiceBazaar.eth, // stable/gold auctions only on eth network
          stableGoldAuction(env.contracts.spiceBazaar.daiGoldAuction)
        );

        const rawInstances =
          response?.stableGoldAuction?.auctionInstances ?? [];

        const metrics: Metric[] = rawInstances
          .map((instance: any) => ({
            id: instance.id,
            timestamp: Number(instance.timestamp),
            date: new Date(
              Number(instance.timestamp) * 1000
            ).toLocaleDateString('en-GB', {
              month: 'short',
              day: 'numeric',
            }),
            value: parseFloat(instance.totalBidTokenAmount),
          }))
          .sort((a, b) => a.timestamp - b.timestamp);

        setData(metrics);
      } catch (err) {
        console.error('Failed to fetch stable gold auction metrics', err);
        setError('Failed to load auction metrics.');
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
