import React, { useMemo } from 'react';

import { ProviderApi } from 'services/ProviderApi';

import { createProviderApi } from 'services/ProviderApi';

import { AppConfig, ChainId } from 'constants/newenv/types';

interface ApiManager {
  papi: ProviderApi;
}

export const ApiManagerContext = React.createContext<ApiManager | undefined>(
  undefined
);

export function ApiManagerProvider(props: {
  appConfig: AppConfig;
  children?: React.ReactNode;
}) {
  const papi = useMemo(() => {
    return createProviderApi(props.appConfig);
  }, [props.appConfig]);

  const apiManager: ApiManager = {
    papi,
  };
  return (
    <ApiManagerContext.Provider value={apiManager}>
      {props.children}
    </ApiManagerContext.Provider>
  );
}

export function useApiManager(): ApiManager {
  const chainSigner = React.useContext(ApiManagerContext);
  if (!chainSigner) {
    throw new Error('useChainSigner invalid outside an ChainSignerProvider');
  }
  return chainSigner;
}

export type AsyncWithSigner = (papi: ProviderApi) => Promise<void>;
export type RequestActionFn = (
  chainId: ChainId,
  action: AsyncWithSigner
) => void;
