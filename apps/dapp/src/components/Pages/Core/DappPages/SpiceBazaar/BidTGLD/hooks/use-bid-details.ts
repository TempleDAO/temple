import { useState, useEffect } from 'react';

export type Transaction = {
  id: number;
  epoch: number;
  status: 'Closed' | 'Active' | 'Upcoming';
  auctionStartDate: string;
  auctionEndDate: string;
  amountTGLD: string;
  priceRatio: string;
};

type UseBidDetailsReturn = {
  data: Transaction[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

const transactionsData: Transaction[] = [
  {
    id: 113,
    epoch: 6,
    status: 'Closed',
    auctionStartDate: '2025-02-02 23:22:59 CST',
    auctionEndDate: '2025-02-03 23:22:59 CST',
    amountTGLD: '20,832.81 TGLD',
    priceRatio: '5.42 USDS',
  },
  {
    id: 112,
    epoch: 5,
    status: 'Closed',
    auctionStartDate: '2025-02-02 23:22:59 CST',
    auctionEndDate: '2025-02-03 23:22:59 CST',
    amountTGLD: '20,832.81 TGLD',
    priceRatio: '5.42 USDS',
  },
  {
    id: 111,
    epoch: 4,
    status: 'Active',
    auctionStartDate: '2025-02-03 23:22:59 CST',
    auctionEndDate: '-',
    amountTGLD: '18,000.00 TGLD',
    priceRatio: '-',
  },
  {
    id: 110,
    epoch: 3,
    status: 'Active',
    auctionStartDate: '2025-02-03 23:22:59 CST',
    auctionEndDate: '-',
    amountTGLD: '18,000.00 TGLD',
    priceRatio: '-',
  },
  {
    id: 109,
    epoch: 2,
    status: 'Upcoming',
    auctionStartDate: '2025-02-03 23:22:59 CST',
    auctionEndDate: '-',
    amountTGLD: '22,500.00 TGLD',
    priceRatio: '-',
  },
  {
    id: 108,
    epoch: 1,
    status: 'Upcoming',
    auctionStartDate: '2025-02-03 23:22:59 CST',
    auctionEndDate: '-',
    amountTGLD: '22,500.00 TGLD',
    priceRatio: '-',
  },
];

export const useBidDetails = (): UseBidDetailsReturn => {
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
