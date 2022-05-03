import { useCallback, useEffect, useState, useMemo } from 'react';
import axios from 'axios';

import useRequestState from 'hooks/use-request-state';
import { useWallet } from 'providers/WalletProvider';
import env from 'constants/env';
import { createVaultGroup } from 'components/Vault/desktop-parts/utils';

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
        periodDuration
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
        periodDuration
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

  const groups = response?.data?.data?.vaultGroups || [];
  const vaultGroups = groups.map((vaultGroup) => createVaultGroup(vaultGroup));

  return {
    vaultGroups,
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

  return {
    vaultGroup: !vaultGroup ? null : createVaultGroup(vaultGroup),
    isLoading: isLoading || requestPending,
    error,
  };
};
