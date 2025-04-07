import { useCallback, useEffect, useState } from 'react';
import { useWallet } from 'providers/WalletProvider';

type Transaction = {
  kekId: string;
  epoch: string;
  type: string;
  tx: string;
};

type UseMyActivityTxnHistoryReturn = {
  data: Transaction[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

const tableData = [
  {
    kekId: '1234',
    epoch: '12/12/2024',
    type: 'Bid',
    tx: '0x192c453a2dbb0b...0e74a056',
  },
  {
    kekId: '1234',
    epoch: '12/12/2024',
    type: 'Claim',
    tx: '0x342c4535430979a...0b6b8b25',
  },
  {
    kekId: '1234',
    epoch: '12/12/2024',
    type: 'Bid',
    tx: '0x192c453a2dbb0b...0e74a056',
  },
  {
    kekId: '1234',
    epoch: '12/12/2024',
    type: 'Bid',
    tx: '0x342c4535430979a...0b6b8b25',
  },
  {
    kekId: '1234',
    epoch: '12/12/2024',
    type: 'Claim',
    tx: '0x192c453a2dbb0b...0e74a056',
  },
];

export const useMyActivityTxnHistory = (): UseMyActivityTxnHistoryReturn => {
  const [data, setData] = useState<Transaction[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { wallet } = useWallet();

  function shortenTxnHash(hash: string) {
    if (!hash || hash.length < 16) return hash;
    return `${hash.slice(0, 16)}...${hash.slice(-8)}`;
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (!wallet) {
        setData([]);
        setLoading(false);
        return;
      }

      setData(tableData);
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch txn history.');
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    fetchData();
  }, [wallet, fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
};
