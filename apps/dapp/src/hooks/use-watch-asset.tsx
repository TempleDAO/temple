import { useNotification } from 'providers/NotificationProvider';
import { useAccount } from 'wagmi';
import { Nullable } from 'types/util';
import useRequestState from './use-request-state';
import env from 'constants/env';

interface Asset {
  address: string;
  decimals?: number;
  image?: string;
  symbol: string;
}

export const TEMPLE_ASSET: Asset = {
  address: env.contracts.temple,
  symbol: 'TEMPLE',
  decimals: 18,
  image: 'https://etherscan.io/token/images/temple_32.png?v=3',
};

type RequestStateType = ReturnType<typeof useRequestState>;

export const useWatchAsset = (asset: Asset): [Nullable<RequestStateType[0]>, RequestStateType[1]] => {
  const { connector } = useAccount();
  const { openNotification } = useNotification();
  const canWatchAsset = !!connector && !!connector.watchAsset;

  const request = async () => {
    if (!canWatchAsset) {
      console.error('Attempted to watchAsset with invalid connector.');
      return;
    }

    const wasAdded = await connector!.watchAsset!(asset);
    if (wasAdded) {
      openNotification({
        title: `Token ${asset.symbol} added to your wallet`,
        hash: asset.address,
      });
    }
  };

  const [watchAsset, state] = useRequestState(request);
  if (!canWatchAsset) {
    return [null, state];
  }

  return [watchAsset, state];
};
