import { useState, useEffect } from 'react';

export type Transaction = {
  kekId: string;
  dateStarted: string;
  dateEnded: string;
  tokenName: string;
  lotSize: number;
  totalTgldBid: number;
  finalPrice: number;
};

type UseBidsHistoryReturn = {
  data: Transaction[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

const transactionsData: Transaction[] = [
  {
    kekId: 'ID name',
    dateStarted: '1742455532',
    dateEnded: '1742455532',
    tokenName: 'Spice 1',
    lotSize: 1848,
    totalTgldBid: 0.1097,
    finalPrice: 0.0819,
  },
  {
    kekId: 'ID name',
    dateStarted: '1742282732',
    dateEnded: '1742282732',
    tokenName: 'Spice 1',
    lotSize: 1848,
    totalTgldBid: 0.1097,
    finalPrice: 0.0819,
  },
  {
    kekId: 'ID name',
    dateStarted: '1742282732',
    dateEnded: '1742282732',
    tokenName: 'Spice 2',
    lotSize: 1848,
    totalTgldBid: 0.1088,
    finalPrice: 0.0919,
  },
  {
    kekId: 'ID name',
    dateStarted: '1742196332',
    dateEnded: '1742196332',
    tokenName: 'Spice 2',
    lotSize: 1848,
    totalTgldBid: 0.1088,
    finalPrice: 0.0919,
  },
  {
    kekId: 'ID name',
    dateStarted: '1742196332',
    dateEnded: '1742196332',
    tokenName: 'Spice 5',
    lotSize: 1848,
    totalTgldBid: 0.1093,
    finalPrice: 0.0811,
  },
  {
    kekId: 'ID name',
    dateStarted: '1741245932',
    dateEnded: '1741245932',
    tokenName: 'Spice 5',
    lotSize: 1848,
    totalTgldBid: 0.1093,
    finalPrice: 0.0811,
  },
  {
    kekId: 'ID name',
    dateStarted: '1741159532',
    dateEnded: '1741159532',
    tokenName: 'Spice 3',
    lotSize: 1848,
    totalTgldBid: 0.1091,
    finalPrice: 0.0829,
  },
  {
    kekId: 'ID name',
    dateStarted: '1741159532',
    dateEnded: '1741159532',
    tokenName: 'Spice 3',
    lotSize: 1848,
    totalTgldBid: 0.1091,
    finalPrice: 0.0829,
  },
  {
    kekId: 'ID name',
    dateStarted: '1741073132',
    dateEnded: '1741073132',
    tokenName: 'Spice 4',
    lotSize: 1848,
    totalTgldBid: 0.1064,
    finalPrice: 0.0862,
  },
  {
    kekId: 'ID name',
    dateStarted: '1741073132',
    dateEnded: '1741073132',
    tokenName: 'Spice 4',
    lotSize: 1848,
    totalTgldBid: 0.1064,
    finalPrice: 0.0862,
  },
];

export const useBidsHistory = (): UseBidsHistoryReturn => {
  const [data, setData] = useState<Transaction[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      setData(transactionsData);
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
