import { useNotification } from 'providers/NotificationProvider';
import { useConnect } from 'wagmi';

import { Nullable } from 'types/util';
import useRequestState from './use-request-state';

interface Asset {
  address: string;
  decimals?: number;
  image?: string;
  symbol: string;
}

const ENV_VARS = import.meta.env;

export const TEMPLE_ASSET: Asset = {
  address: ENV_VARS.VITE_PUBLIC_TEMPLE_ADDRESS,
  symbol: 'TEMPLE',
  decimals: 18,
  image: 'https://etherscan.io/token/images/temple_32.png?v=3',
};

type RequestStateType = ReturnType<typeof useRequestState>;

export const useWatchAsset = (asset: Asset): [Nullable<RequestStateType[0]>, RequestStateType[1]] => {
  const { activeConnector } = useConnect();
  const { openNotification } = useNotification();
  const canWatchAsset = !!activeConnector && !!activeConnector.watchAsset;

  const request = async () => {
    if (!canWatchAsset) {
      console.error('Attempted to watchAsset with invalid connector.');
      return;
    }

    const wasAdded = await activeConnector!.watchAsset!(asset);
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
