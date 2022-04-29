import { useCallback, useEffect, useState, useMemo } from 'react';
import axios, { AxiosRequestConfig } from 'axios';

import useRequestState from 'hooks/use-request-state';
import { useWallet } from 'providers/WalletProvider';
import env from 'constants/env';
import { createVault } from 'components/Vault/desktop-parts/utils';

import {
  SubGraphQuery,
  GetVaultGroupsResponse,
  GetVaultResponse,
} from './types'

const createGetVaultGroupsQuery = (walletAddress = ''): SubGraphQuery => ({
  query: `{
    vaultGroups {
      id
      vaults {
        tvl
        id
        users(where: {id: "${walletAddress.toLowerCase()}"}) {
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
    }
  }`,
});


const createGetVaultRequest = (vaultAddress: string, walletAddress = ''): SubGraphQuery => ({
  query: `{
    vault(id: "${vaultAddress.toLowerCase()}") {
      tvl
      id
      users(where: {id: "${walletAddress.toLowerCase()}"}) {
        vaultUserBalances(orderBy: timestamp) {
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
});

const creatGetUserBalances = (vaultAddress: string, walletAddress: string): SubGraphQuery => ({
  query: `{
    vaultUserBalances(orderBy: timestamp where: { id: "${vaultAddress.toLowerCase()}${walletAddress.toLowerCase()}" }) {
      id
      timestamp
      value
      amount
    }
  }`,
});

export const useListCoreVaults = () => {
  const { wallet, isConnecting } = useWallet();
  const [isLoading, setIsLoading] = useState(true);

  const getVaults = useCallback(() => axios.post<GetVaultGroupsResponse>(env.subgraph.templeCore, createGetVaultGroupsQuery(wallet || '')), [wallet]);
  const [request, { response, isLoading: requestPending, error }] = useRequestState(getVaults);

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

  const groups = response?.data?.data?.vaultGroups;
  const vaults = useMemo(() => {
    if (!groups) {
      return [];
    }
    return groups.map(({ vaults, id }) => {
      return {
        id,
        vaults: vaults.map((vault) => createVault(vault)),
      };
    });
  }, [groups]);

  return {
    vaults,
    isLoading: isLoading || requestPending,
    error,
  };
};

export const useGetCoreVault = (vaultAddress: string) => {
  const { wallet, isConnecting } = useWallet();
  const [isLoading, setIsLoading] = useState(true);
  
  const getVault = useCallback(() => 
    axios.post<GetVaultResponse>(env.subgraph.templeCore, createGetVaultRequest(vaultAddress, wallet || '')), [vaultAddress, wallet]);

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

  const vaultData = response?.data?.data?.vault;
  const vault = useMemo(() => {
    if (!vaultData) {
      return null;
    }
    return createVault(vaultData)
  }, [vaultData]);

  return {
    vault,
    isLoading: isLoading || requestPending,
    error,
  };
};

export const useGetCoreVaultUserDeposits = (vaultAddress: string) => {
  const { wallet, isConnecting } = useWallet();
  const [isLoading, setIsLoading] = useState(true);
  
  const getVault = useCallback(() => 
    axios.post(env.subgraph.templeCore, creatGetUserBalances(vaultAddress, wallet || '')), [vaultAddress, wallet]);

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