import { useState, useEffect } from 'react';

export type Transaction = {
  status: string;
  auctionName: string;
  totalVolume: number;
  floorPrice: number;
  bestOffer: number;
  details: string;
  bid: string;
};

type UseBidsHistoryReturn = {
  data: Transaction[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

const transactionsData: Transaction[] = [
  {
    status: 'Upcoming 2025-02-03 23:22:59 CST',
    auctionName: 'Spice 1',
    totalVolume: 1848,
    floorPrice: 0.1097,
    bestOffer: 0.0819,
    details: 'details',
    bid: '',
  },
  {
    status: 'Upcoming 2025-02-03 23:22:59 CST',
    auctionName: 'Spice 1',
    totalVolume: 1848,
    floorPrice: 0.1097,
    bestOffer: 0.0819,
    details: 'details',
    bid: '',
  },
  {
    status: 'Ends in 00:15:03:04 at 2025-02-03 23:22:59 CST',
    auctionName: 'Spice 1',
    totalVolume: 1848,
    floorPrice: 0.1097,
    bestOffer: 0.0819,
    details: 'details',
    bid: '',
  },
  {
    status: 'Ends in 00:15:03:04 at 2025-02-03 23:22:59 CST',
    auctionName: 'Spice 1',
    totalVolume: 1848,
    floorPrice: 0.1097,
    bestOffer: 0.0819,
    details: 'details',
    bid: '',
  },
  {
    status: 'Closed at 2025-02-03 23:22:59 CST',
    auctionName: 'Spice 1',
    totalVolume: 1848,
    floorPrice: 0.1097,
    bestOffer: 0.0819,
    details: 'details',
    bid: '',
  },
  {
    status: 'Closed at 2025-02-03 23:22:59 CST',
    auctionName: 'Spice 1',
    totalVolume: 1848,
    floorPrice: 0.1097,
    bestOffer: 0.0819,
    details: 'details',
    bid: '',
  },
  {
    status: 'Closed at 2025-02-03 23:22:59 CST',
    auctionName: 'Spice 1',
    totalVolume: 1848,
    floorPrice: 0.1097,
    bestOffer: 0.0819,
    details: 'details',
    bid: '',
  },
];

export const useBidsHistory = (): UseBidsHistoryReturn => {
  const [data, setData] = useState<Transaction[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);

    try {
      setData(transactionsData);
      setLoading(false);
    } catch (err) {
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
