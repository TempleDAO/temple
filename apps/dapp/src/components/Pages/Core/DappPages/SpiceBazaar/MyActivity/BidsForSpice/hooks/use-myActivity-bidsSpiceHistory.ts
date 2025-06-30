import { useCallback, useEffect, useState } from 'react';
import { user, cachedSubgraphQuery } from 'utils/subgraph';
import { useWallet } from 'providers/WalletProvider';
import type { Transaction } from '../DataTables/BidDataTable';
import { Auction } from 'components/Pages/Core/DappPages/SpiceBazaar/MyActivity/BidsForTGLD/hooks/use-myActivity-bidsTGLDHistory';
import { useSpiceAuction } from 'providers/SpiceAuctionProvider';
import { getAllSpiceBazaarSubgraphEndpoints } from 'constants/env/getSpiceBazaarEndpoints';

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
    const currentTime = Math.floor(Date.now() / 1000);

    if (Number(endTime) > currentTime) return 'Bid';
    if (
      Number(endTime) < currentTime &&
      parseFloat(totalBid) > 0 &&
      !hasClaimed
    )
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

      const responses = await Promise.all(
        getAllSpiceBazaarSubgraphEndpoints().map((entry) =>
          cachedSubgraphQuery(
            entry.url,
            user(wallet, Auction.SpiceAuction)
          ).then((res) => ({
            data: res,
            label: entry.label,
          }))
        )
      );

      const allPositions = responses.flatMap(({ data, label }) =>
        (data.user?.positions || []).map((p: any) => ({
          ...p,
          _subgraphLabel: label,
        }))
      );

      const positions = await Promise.all(
        allPositions.map(async (p: any) => {
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
            id: `${p.auctionInstance.id}-${p._subgraphLabel}`, // just to make them unique for testing
            epoch: p.auctionInstance.epoch,
            auctionEndDateTime: p.auctionInstance.endTime,
            claimableTokens,
            unitPrice: parseFloat(p.auctionInstance.priceRatio).toFixed(5),
            bidTotal: parseFloat(p.totalBidAmount).toFixed(2),
            action: actionResult,
            auctionStaticConfig: targetAuction?.staticConfig,
            token: targetAuction?.auctionTokenSymbol,
            name: p.auctionInstance.spiceAuction?.name || '-',
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
