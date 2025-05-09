import { useCallback, useEffect, useState } from 'react';
import { user, subgraphQuery } from 'utils/subgraph';
import { useWallet } from 'providers/WalletProvider';
import type { Transaction } from '../DataTables/BidDataTable';
import { Auction } from 'components/Pages/Core/DappPages/SpiceBazaar/MyActivity/BidsForTGLD/hooks/use-myActivity-bidsTGLDHistory';
import env from 'constants/env';
import { useSpiceAuction } from 'providers/SpiceAuctionProvider';

export const useMyActivityBidsSpiceHistory = (): {
  data: Transaction[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} => {
  const [data, setData] = useState<Transaction[] | null>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { wallet } = useWallet();
  const {
    allSpiceAuctions: { data: allAuctions },
    currentUser: { getClaimableAtEpoch },
  } = useSpiceAuction();

  const action = async (
    endTime: string,
    totalBid: string,
    hasClaimed: boolean
  ): Promise<'Bid' | 'Claim' | ''> => {
    const currentTime = Date.now().toString();

    if (endTime > currentTime) return 'Bid';
    if (endTime < currentTime && parseFloat(totalBid) > 0 && !hasClaimed)
      return 'Claim';

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
        user(wallet, Auction.SpiceAuction)
      );

      const positions = await Promise.all(
        response.user.positions.map(async (p: any) => {
          const actionResult = await action(
            p.auctionInstance.endTime,
            p.totalBidAmount,
            p.hasClaimed
          );

          let claimableTokens: number | undefined = undefined;

          const auctionId = p.auctionInstance.id;
          const auctionAddress = auctionId?.split('-')[0]?.toLowerCase();
          const targetAuction = allAuctions.find(
            (a) =>
              a.staticConfig.contractConfig.address.toLowerCase() ===
              auctionAddress
          );

          if (!targetAuction) {
            console.warn(
              `Could not find matching auction config for auction address ${auctionAddress}`
            );
          } else if (actionResult === 'Claim') {
            try {
              claimableTokens = await getClaimableAtEpoch(
                targetAuction,
                Number(p.auctionInstance.epoch)
              );
            } catch (err) {
              console.error(
                `Failed to fetch claimable tokens for epoch ${p.auctionInstance.epoch}`,
                err
              );
            }
          }

          return {
            epoch: p.auctionInstance.epoch,
            auctionEndDateTime: p.auctionInstance.endTime,
            claimableTokens,
            unitPrice: parseFloat(p.auctionInstance.priceRatio).toFixed(5),
            bidTotal: parseFloat(p.totalBidAmount).toFixed(2),
            action: actionResult,
            auctionStaticConfig: targetAuction?.staticConfig,
            token: targetAuction?.auctionTokenSymbol,
          };
        })
      );

      setData(positions as Transaction[]);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch auction history.');
    } finally {
      setLoading(false);
    }
  }, [wallet, allAuctions, getClaimableAtEpoch]);

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
