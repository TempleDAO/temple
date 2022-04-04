import { useCallback, useState } from 'react';

import useIsMounted from 'hooks/use-is-mounted';
import { useNotification } from 'providers/NotificationProvider';
import { Nullable } from 'types/util';
import { Token } from 'constants/tokens';

type HookReturnValue = [
  () => Promise<void>,
  { isLoading: boolean, error: Nullable<Error> }
];

const useRegisterToken = (token: Token): HookReturnValue => {
  const { openNotification } = useNotification();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Nullable<Error>>(null);
  const isMounted = useIsMounted();

  const registerToken = useCallback(async () => {    
    if (!window.ethereum) {
      console.error('Global ethereum not available');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const wasAdded = await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: token,
      });

      if (wasAdded) {
        openNotification({
          title: `Token ${token.options.symbol} added to your assets`,
          hash: token.options.address,
        });
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err as Error);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false)
      }
    }
  }, [openNotification, setIsLoading, token, isMounted, setError]);

  return [
    registerToken,
    { isLoading, error },
  ];
};

export default useRegisterToken;
