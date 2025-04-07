import { useCallback, useEffect, useState } from 'react';
import { useWallet } from 'providers/WalletProvider';
import { useSpiceBazaar } from 'providers/SpiceBazaarProvider';

type Transaction = {
  kekId: string;
  auctionEndDateTime: string;
  chain: string;
  token: string;
  claimableTokens: number | undefined;
  unitPrice: string;
  bidTotal: string;
  action: 'Bid' | 'Claim' | '';
};

type useMyActivityBidsSpiceHistoryReturn = {
  data: Transaction[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

const transactions: Transaction[] = [
  {
    kekId: 'ID',
    auctionEndDateTime: '30.09.2024',
    chain: 'Chain 1',
    token: 'WSBI',
    claimableTokens: undefined,
    unitPrice: '-',
    bidTotal: '100 TLGD',
    action: 'Claim',
  },
  {
    kekId: 'ID',
    auctionEndDateTime: '14.10.2024',
    chain: 'Chain 1',
    token: 'WSBI',
    claimableTokens: 100000,
    unitPrice: '231',
    bidTotal: '100 TLGD',
    action: 'Claim',
  },
  {
    kekId: 'ID',
    auctionEndDateTime: '28.10.2024',
    chain: 'Chain 1',
    token: 'ENA',
    claimableTokens: 200000,
    unitPrice: '99',
    bidTotal: '100 TLGD',
    action: 'Claim',
  },
  {
    kekId: 'ID',
    auctionEndDateTime: '30.09.2024',
    chain: 'Chain 1',
    token: 'WSBI',
    claimableTokens: 150000,
    unitPrice: '78',
    bidTotal: '100 TLGD',
    action: 'Claim',
  },
  {
    kekId: 'ID',
    auctionEndDateTime: '-',
    chain: 'Chain 1',
    token: 'ENA',
    claimableTokens: undefined,
    unitPrice: '-',
    bidTotal: '100 TLGD',
    action: 'Claim',
  },
];

export const useMyActivityBidsSpiceHistory =
  (): useMyActivityBidsSpiceHistoryReturn => {
    const [data, setData] = useState<Transaction[] | null>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const { wallet } = useWallet();

    const {
      currentUser: { getClaimableAtEpoch },
    } = useSpiceBazaar();

    const action = async (
      endTime: string,
      totalBid: string,
      hasClaimed: boolean
    ) => {
      const currentTime = new Date().getTime().toString();

      if (endTime > currentTime) {
        return 'Bid';
      }

      if (endTime < currentTime && parseFloat(totalBid) > 0 && !hasClaimed) {
        return 'Claim';
      }

      return '';
    };

    const fetchData = useCallback(async () => {
      setLoading(true);
      setError(null);

      try {
        if (!wallet) {
          setData([]);
          setLoading(false);
          return;
        }

        setData(transactions);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to fetch auction history.');
        setLoading(false);
      }
    }, [getClaimableAtEpoch, wallet]);

    // refresh when wallet changes
    useEffect(() => {
      fetchData();
    }, [wallet, fetchData]);

    return {
      data,
      loading,
      error,
      refetch: () => fetchData(),
    };
  };
