import { useWallet } from 'providers/WalletProvider';
import { useEffect, useState } from 'react';
import { cachedSubgraphQuery, user } from 'utils/subgraph';
import { Auction } from '../../BidsForTGLD/hooks/use-myActivity-bidsTGLDHistory';
import { formatNumberWithCommasAndDecimals } from 'utils/formatter';
import { getAllSpiceBazaarSubgraphEndpoints } from 'constants/env/getSpiceBazaarEndpoints';

// TODO: Possibly combine with redeem amount hook
export const useMyActivityRewardAmount = () => {
  const { wallet } = useWallet();
  const [rewardAmount, setRewardAmount] = useState<string | null>(null);

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
          const value = Number(res.user?.rewardAmount || 0);
          return acc + value;
        }, 0);

        setRewardAmount(formatNumberWithCommasAndDecimals(total));
      } catch (err) {
        console.error('Failed to fetch rewardAmount', err);
        setRewardAmount('0');
      }
    };

    fetchRedeem();
  }, [wallet]);

  return rewardAmount;
};
