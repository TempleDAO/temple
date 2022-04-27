import { useCallback, useEffect, useState } from 'react';
import axios, { AxiosRequestConfig } from 'axios';

import useRequestState from 'hooks/use-request-state';
import { useWallet } from 'providers/WalletProvider';
import env from 'constants/env';

const createGetCoreVaultsRequest = (): AxiosRequestConfig => {
  return {
    method: 'post',
    url: env.subgraph.templeCore,
    headers: {
      'Content-Type': 'application/json',
    },
    data: {
      query: `{
        vaults {
          id
          name
          tvl
          firstPeriodStartTimestamp
          enterExitWindowDuration
        }
      }`,
    },
  };
};


const createGetVaultRequest = (vaultAddress: string, walletAddress = ''): AxiosRequestConfig => {
  return {
    method: 'post',
    url: env.subgraph.templeCore,
    headers: {
      'Content-Type': 'application/json',
    },
    data: {
      query: `{
        vault(id: "${vaultAddress.toLowerCase()}") {
          tvl
          id
          users(where: {id: "${walletAddress.toLowerCase()}"}) {
            vaultUserBalances(orderBy: timestamp where: { id: "${vaultAddress.toLowerCase()}${walletAddress.toLowerCase()}" }) {
              id
              timestamp
              value
              amount
            }
            id
            totalBalance
            depositsBalance
            deposits {
              amount
              id
              timestamp
              value
            }
          }
          timestamp
          templeToken
          symbol
          shareBoostFactor
          periodDuration
          name
          joiningFee
          enterExitWindowDuration
        }
      }`,
    },
  };
};

const createGetVaultUserRequest = (address: string): AxiosRequestConfig => {
  return {
    method: 'post',
    url: env.subgraph.templeCore,
    headers: {
      'Content-Type': 'application/json',
    },
    data: {
      query: `{
        user(id: "${address}") {
          id
          timestamp
          totalBalance
          deposits {
            id
            timestamp
          }
        }
      }`,
    },
  };
};

export const useListCoreVaults = () => {
  const getVaults = useCallback(() => axios(createGetCoreVaultsRequest()), []);
  const [request, { response, isLoading, error }] = useRequestState(getVaults);

  useEffect(() => {
    request();
  }, [request]);

  return {
    vaults: response?.data?.data?.vaults || [],
    isLoading,
    error,
  };
};

export const useGetCoreVault = (vaultAddress: string) => {
  const { wallet, isConnecting } = useWallet();
  const [isLoading, setIsLoading] = useState(true);
  
  const getVault = useCallback(
    () => axios(createGetVaultRequest(vaultAddress, wallet || '')), [vaultAddress, wallet]);

  const [request, { response, isLoading: requestPending, error }] = useRequestState(getVault);
  
  useEffect(() => {
    if (isConnecting) {
      return;
    }

    const getVault = async () => {
      setIsLoading(true);
      await request();
      setIsLoading(false);
    };

    getVault();
  }, [request, isConnecting]);

  return {
    vault: response?.data?.data?.vault || null,
    isLoading: isLoading || requestPending,
    error,
  };
};

export const useGetVaultUser = (address: string, skip = false) => {
  const getVaultUser = useCallback(() => axios(createGetVaultUserRequest(address)), [address]);
  const [request, { response, isLoading, error }] = useRequestState(getVaultUser);

  useEffect(() => {
    if (skip) {
      return;
    }
    request();
  }, [request]);

  return {
    user: response?.data?.data?.user || null,
    isLoading,
    error,
  }
};

export const useClaimFromVault = (vaultAddress: string, ) => {


}