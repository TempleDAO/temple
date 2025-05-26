import { useWallet } from 'providers/WalletProvider';
import { useEffect, useState } from 'react';
import { cachedSubgraphQuery, user } from 'utils/subgraph';
import { Auction } from '../../BidsForTGLD/hooks/use-myActivity-bidsTGLDHistory';
import { formatNumberWithCommasAndDecimals } from 'utils/formatter';
import { getAllSpiceBazaarSubgraphEndpoints } from 'constants/env/getSpiceBazaarEndpoints';

export const useMyActivityRedeemAmountSpice = () => {
  const { wallet } = useWallet();
  const [redeemAmount, setRedeemAmount] = useState<string | null>(null);

  useEffect(() => {
    const fetchRedeem = async () => {
      if (!wallet) return;

      try {
        const responses = await Promise.all(
          getAllSpiceBazaarSubgraphEndpoints().map((entry) =>
            cachedSubgraphQuery(entry.url, user(wallet, Auction.SpiceAuction))
          )
        );

        const total = responses.reduce((acc, res) => {
          const value = Number(res.user?.redeemAmount || 0);
          return acc + value;
        }, 0);

        setRedeemAmount(formatNumberWithCommasAndDecimals(total));
      } catch (err) {
        console.error('Failed to fetch redeemAmount', err);
        setRedeemAmount('0');
      }
    };

    fetchRedeem();
  }, [wallet]);

  return redeemAmount;
};
