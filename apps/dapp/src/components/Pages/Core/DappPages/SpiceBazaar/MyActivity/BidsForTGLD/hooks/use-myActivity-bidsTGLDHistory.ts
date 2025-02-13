import { useCallback, useEffect, useState } from 'react';
import { user, subgraphQuery } from 'utils/subgraph';
import type { Transaction } from '../../DataTables/BidDataTable';
import { useWallet } from 'providers/WalletProvider';
import { useSpiceBazaar } from 'providers/SpiceBazaarProvider';
import { formatNumberWithCommas } from 'utils/formatter';
import env from 'constants/env';

export enum Auction {
  SpiceAuction = 'SpiceAuction',
  StableGoldAuction = 'StableGoldAuction',
}

type useMyActivityBidsTGLDHistoryReturn = {
  data: Transaction[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export const useMyActivityBidsTGLDHistory =
  (): useMyActivityBidsTGLDHistoryReturn => {
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

        const response = await subgraphQuery(
          env.subgraph.spiceBazaar,
          user(wallet, Auction.StableGoldAuction)
        );

        const positions = await Promise.all(
          response.user.positions.map(async (p: any) => {
            const actionResult = await action(
              p.auctionInstance.endTime,
              p.totalBidAmount,
              p.hasClaimed
            );

            // do not fetch unless the action is "Claim"
            const claimableTokens =
              actionResult === 'Claim' &&
              (await getClaimableAtEpoch(p.auctionInstance.epoch));

            return {
              epochId: p.auctionInstance.epoch,
              auctionEndDateTime: p.auctionInstance.endTime,
              bidAmount: parseFloat(p.totalBidAmount).toFixed(2),
              claimableTokens,
              unit: 'TGLD',
              unitPrice: parseFloat(p.auctionInstance.priceRatio).toFixed(5),
              action: actionResult,
            };
          })
        );

        setData(positions as Transaction[]);
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
