import { useWallet } from 'providers/WalletProvider';
import { useQuery } from '@tanstack/react-query';
import { cachedSubgraphQuery, user } from 'utils/subgraph';
import { Auction } from '../../BidsForTGLD/hooks/use-myActivity-bidsTGLDHistory';
import { formatNumberWithCommasAndDecimals } from 'utils/formatter';
import { getAllSpiceBazaarSubgraphEndpoints } from 'constants/env/getSpiceBazaarEndpoints';

export const useMyActivityRedeemAmountSpice = () => {
  const { wallet } = useWallet();

  const { data: redeemAmount } = useQuery({
    queryKey: ['spiceRedeemAmount', wallet],
    queryFn: async () => {
      if (!wallet) return null;

      try {
        const responses = await Promise.all(
          getAllSpiceBazaarSubgraphEndpoints().map((entry) =>
            cachedSubgraphQuery(entry.url, user(wallet, Auction.SpiceAuction))
          )
        );

        const total = responses.reduce((acc, res) => {
          const value = Number(
            res.user?.claimedTokens?.reduce((acc, token) => {
              return acc + Number(token.amount);
            }, 0) || 0
          );
          return acc + value;
        }, 0);

        return formatNumberWithCommasAndDecimals(total);
      } catch (err) {
        console.error('Failed to fetch redeemAmount', err);
        return '0';
      }
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!wallet,
  });

  return redeemAmount;
};
