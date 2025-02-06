import { useEffect, useState } from 'react';
import type { Transaction } from '../../DataTables/BidDataTable';

type useMyActivityBidsSpiceHistoryReturn = {
  data: Transaction[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

const transactionsData: Transaction[] = [
  {
    epochId: '1',
    auctionEndDateTime: '30.09.2024',
    bidAmount: '100',
    claimableTokens: 0,
    unit: 'WSBI',
    unitPrice: '-',
    action: 'Bid',
  },
  {
    epochId: '2',
    auctionEndDateTime: '14.10.2024',
    bidAmount: '100',
    claimableTokens: 100000,
    unit: 'WSBI',
    unitPrice: '231',
    action: 'Claim',
  },
  {
    epochId: '3',
    auctionEndDateTime: '28.10.2024',
    bidAmount: '100',
    claimableTokens: 200000,
    unit: 'ENA',
    unitPrice: '99',
    action: 'Claim',
  },
  {
    epochId: '4',
    auctionEndDateTime: '28.10.2024',
    bidAmount: '100',
    claimableTokens: 150000,
    unit: 'WSBI',
    unitPrice: '78',
    action: 'Bid',
  },
  {
    epochId: '5',
    auctionEndDateTime: '-',
    bidAmount: '100',
    claimableTokens: 0,
    unit: 'ENA',
    unitPrice: '-',
    action: 'Bid',
  },
];

export const useMyActivityBidsSpiceHistory =
  (): useMyActivityBidsSpiceHistoryReturn => {
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
