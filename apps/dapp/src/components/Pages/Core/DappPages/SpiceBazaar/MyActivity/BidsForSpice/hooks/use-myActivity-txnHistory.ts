import { useEffect, useState } from 'react';
import type { Transaction } from '../../DataTables/TransactionsDataTable';

type UseMyActivityTxnHistoryReturn = {
  data: Transaction[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

const transactionsData: Transaction[] = [
  {
    epoch: '12/11/2024',
    type: 'Bid',
    transactionLink: '0x192c453a2dbb0b...0e74a056',
    id: '',
    transactionHash: '',
  },
  {
    epoch: '12/11/2024',
    type: 'Claim',
    transactionLink: '0x342c4535430979a...0b6b8b25',
    id: '',
    transactionHash: '',
  },
  {
    epoch: '12/11/2024',
    type: 'Bid',
    transactionLink: '0x192c453a2dbb0b...0e74a056',
    id: '',
    transactionHash: '',
  },
  {
    epoch: '12/11/2024',
    type: 'Bid',
    transactionLink: '0x192c453a2dbb0b...0e74a056',
    id: '',
    transactionHash: '',
  },
  {
    epoch: '12/11/2024',
    type: 'Claim',
    transactionLink: '0x192c453a2dbb0b...0e74a056',
    id: '',
    transactionHash: '',
  },
  {
    epoch: '12/11/2024',
    type: 'Claim',
    transactionLink: '0x192c453a2dbb0b...0e74a056',
    id: '',
    transactionHash: '',
  },
  {
    epoch: '12/11/2024',
    type: 'Claim',
    transactionLink: '0x192c453a2dbb0b...0e74a056',
    id: '',
    transactionHash: '',
  },
];

export const useMyActivityTxnHistory = (): UseMyActivityTxnHistoryReturn => {
  const [data, setData] = useState<Transaction[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  function shortenTxnHash(hash: string) {
    if (!hash || hash.length < 16) return hash;
    return `${hash.slice(0, 16)}...${hash.slice(-8)}`;
  }

  const fetchData = () => {
    setLoading(true);
    setError(null);

    try {
      setData(transactionsData);
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch txn history.');
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
