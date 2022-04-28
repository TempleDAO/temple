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
          firstPeriodStartTimestamp
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
          periodDuration
          deposits {
            id
            timestamp
          }
        }
      }`,
    },
  };
};


const creatGetUserBalances = (vaultAddress: string, walletAddress: string): AxiosRequestConfig => {
  return {
    method: 'post',
    url: env.subgraph.templeCore,
    headers: {
      'Content-Type': 'application/json',
    },
    data: {
      query: `{
        vaultUserBalances(orderBy: timestamp where: { id: "${vaultAddress.toLowerCase()}${walletAddress.toLowerCase()}" }) {
          id
          timestamp
          value
          amount
        }
      }`,
    },
  };
}

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

export const useGetCoreVaultUserDeposits = (vaultAddress: string) => {
  const { wallet, isConnecting } = useWallet();
  const [isLoading, setIsLoading] = useState(true);
  
  const getVault = useCallback(
    () => axios(creatGetUserBalances(vaultAddress, wallet || '')), [vaultAddress, wallet]);

  const [request, { response, error }] = useRequestState(getVault);

  const wrappedRequest = useCallback(async () => {
    setIsLoading(true);
    await request();
    setIsLoading(false);
  }, [request, setIsLoading]);

  useEffect(() => {
    if (isConnecting || !wallet) {
      return;
    }

    wrappedRequest();
  }, [request, isConnecting, wallet]);

  return {
    isLoading,
    error,
    vaultUserBalances: response?.data?.data?.vaultUserBalances || [],
  };
};