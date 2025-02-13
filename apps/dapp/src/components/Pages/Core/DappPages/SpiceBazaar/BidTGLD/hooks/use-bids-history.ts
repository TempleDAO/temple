import { useState, useEffect } from 'react';
import { spiceAuctionFactories, subgraphQuery } from 'utils/subgraph';
import env from 'constants/env';

export type Transaction = {
  status: 'Upcoming' | 'Active' | 'Closed';
  auctionName: string;
  totalVolume: number;
  floorPrice: number;
  bestOffer: number;
  details: string;
  bid: string;
  startTime: string;
  endTime: string;
};

type UseBidsHistoryReturn = {
  data: Transaction[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export const useBidsHistory = (): UseBidsHistoryReturn => {
  const [data, setData] = useState<Transaction[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
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
        spiceAuctionFactories(env.contracts.spiceBazaar.spiceAuctionFactory)
      );

      setData(
        response.spiceAuctionFactories.flatMap((factory) =>
          factory.spiceAuctions.flatMap((auction) =>
            auction.auctionInstances.slice(0, 3).map((instance) => {
              const startTime = instance.startTime;
              const endTime = (
                Number(startTime) + Number(instance.duration)
              ).toString();

              return {
                status: getAuctionStatus(
                  startTime.toString(),
                  endTime.toString()
                ),
                auctionName: auction.name.replace(/_/g, ' '),
                totalVolume: Number(instance.totalAuctionTokenAmount) || 0,
                floorPrice: 0, // Placeholder
                bestOffer: 0, // Placeholder
                details: 'details',
                bid: '',
                startTime,
                endTime,
              };
            })
          )
        )
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
