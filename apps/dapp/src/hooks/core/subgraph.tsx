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

const createVaultUserFragment = (walletAddress = '') => {
  return `
    users(where: {id: "${walletAddress.toLowerCase()}"}) {
      id
      totalBalance
      depositsBalance
      deposits(orderBy: timestamp) {
        amount
        id
        timestamp
        value
      }
      vaultUserBalances(orderBy: timestamp) {
        id
        timestamp
        value
        amount
      }
    }
  `;
}

const createGetVaultGroupsQuery = (walletAddress = ''): SubGraphQuery => ({
  query: `{
    vaultGroups {
      id
      vaults {
        tvl
        id
        ${createVaultUserFragment(walletAddress)}
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


const createVaultGroupQuery = (vaultGroupId: string, walletAddress = ''): SubGraphQuery => ({
  query: `{
    vaultGroup(id: "${vaultGroupId.toLowerCase()}") {
      id
      vaults {
        tvl
        id
        ${createVaultUserFragment(walletAddress)}
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

export const useListCoreVaultGroups = () => {
  const { wallet, isConnecting } = useWallet();
  const [isLoading, setIsLoading] = useState(true);

  const getVaults = useCallback(() => {
    const query = createGetVaultGroupsQuery(wallet || '');
    return axios.post<GetVaultGroupsResponse>(env.subgraph.templeCore, query);
  }, [wallet]);

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

export const useGetVaultGroup = (vaultGroupId: string) => {
  const { wallet, isConnecting } = useWallet();
  const [isLoading, setIsLoading] = useState(true);
  
  const getVault = useCallback(() => {
    const query = createVaultGroupQuery(vaultGroupId, wallet || '');
    return axios.post<GetVaultResponse>(env.subgraph.templeCore, query);
  }, [vaultGroupId, wallet]);

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

  const vaultGroup = response?.data?.data?.vaultGroup;
  const vault = useMemo(() => {
    if (!vaultGroup) {
      return null;
    }
    
    return {
      ...vaultGroup,
      vaults: vaultGroup.vaults.map((vault) => createVault(vault)),
    };
  }, [vaultGroup]);

  return {
    vault,
    isLoading: isLoading || requestPending,
    error,
  };
};

export const useGetCoreVaultUserDeposits = (vaultAddress: string) => {
  const { wallet, isConnecting } = useWallet();
  const [isLoading, setIsLoading] = useState(true);
  
  const getVault = useCallback(() => {
    const query = creatGetUserBalances(vaultAddress, wallet || '');
    return axios.post(env.subgraph.templeCore, query);
  }, [vaultAddress, wallet]);

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