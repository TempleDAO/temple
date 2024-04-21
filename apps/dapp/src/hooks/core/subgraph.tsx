import type {
  SubGraphQuery,
  GetVaultGroupsResponse,
  GetVaultGroupResponse,
  GetMetricsResponse,
} from './types';

import { useEffect, useState, useMemo, useRef } from 'react';

import { useWallet } from 'providers/WalletProvider';
import env from 'constants/env';
import { createVaultGroup } from 'components/Vault/utils';
import { useSubgraphRequest } from 'hooks/use-subgraph-request';

const createVaultUserFragment = (walletAddress = '') => {
  return `
    users(where: {id: "${walletAddress.toLowerCase()}"}) {
      id
      totalBalance
      depositsBalance
      vaultUserBalances(orderBy: timestamp) {
        id
        timestamp
        value
        amount
        staked
      }
      deposits(orderBy: timestamp) {
        id
        amount
        timestamp
      }
      withdraws(orderBy: timestamp) {
        id
        amount
        timestamp
      }
    }
  `;
};

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

export const createUserTransactionsQuery = (
  walletAddress: string
): SubGraphQuery => {
  return {
    query: `{
      user(id: "${walletAddress.toLowerCase()}") {
        id
        deposits(orderBy: timestamp) {
          id
          timestamp
          amount
        }
        withdraws(orderBy: timestamp) {
          id
          timestamp
          amount
        }
      }
    }`,
  };
};

const createVaultGroupQuery = (
  vaultGroupId: string,
  walletAddress = ''
): SubGraphQuery => ({
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

export const useVaultMetrics = () => {
  const [request, resp] = useSubgraphRequest<GetMetricsResponse>(
    env.subgraph.templeCore,
    {
      query: `{
        metrics {
          tvlUSD
        }
      }`,
    }
  );

  useEffect(() => {
    request();
  }, [request]);

  return resp;
};

export const useListCoreVaultGroups = () => {
  const { wallet, isConnecting } = useWallet();
  const didRequest = useRef(false);
  const [isLoading, setIsLoading] = useState(true);

  const [request, { response, isLoading: requestPending, error }] =
    useSubgraphRequest<GetVaultGroupsResponse>(
      env.subgraph.templeCore,
      createGetVaultGroupsQuery(wallet || '')
    );

  useEffect(() => {
    if (isConnecting) {
      return;
    }

    if (didRequest.current) {
      return;
    }

    const requestVaultGroups = async () => {
      await request();
      setIsLoading(false);
    };

    requestVaultGroups();
    didRequest.current = true;
  }, [request, isConnecting, didRequest]);

  const groups = response?.data?.vaultGroups;
  const vaultGroups = useMemo(() => {
    return (groups || []).map((vaultGroup) => createVaultGroup(vaultGroup));
  }, [groups]);

  return {
    vaultGroups,
    isLoading: isLoading || requestPending,
    error,
  };
};

export const useGetVaultGroup = (vaultGroupId: string) => {
  const { wallet, isConnecting } = useWallet();
  const [isLoading, setIsLoading] = useState(true);

  const [request, { response, isLoading: requestPending, error }] =
    useSubgraphRequest<GetVaultGroupResponse>(
      env.subgraph.templeCore,
      createVaultGroupQuery(vaultGroupId, wallet || '')
    );

  useEffect(() => {
    if (isConnecting) {
      return;
    }

    const getVault = async () => {
      await request();
      setIsLoading(false);
    };

    getVault();
  }, [request, isConnecting]);

  const vaultGroup = response?.data?.vaultGroup;

  return {
    vaultGroup: !vaultGroup ? null : createVaultGroup(vaultGroup),
    isLoading: isLoading || requestPending,
    error,
  };
};
