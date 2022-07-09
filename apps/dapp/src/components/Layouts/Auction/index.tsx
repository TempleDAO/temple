import { useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { Outlet, useOutletContext, Link } from 'react-router-dom';

import { useSubgraphRequest } from 'hooks/use-subgraph-request';
import Loader from 'components/Loader/Loader';
import { PillMenu } from 'components/PillMenu';

import { AuctionContext, GraphResponse } from './types';
import { createPool } from './utils';
import env from 'constants/env';

const QUERY = {
  query: `
    {
      pools(where: {address: "0xefdEc913b82E55287Fb83DF3c058891B724dba28", poolType: "LiquidityBootstrapping"}) {
        id
        address
        strategyType
        symbol
        name
        swapEnabled
        swapFee
        owner
        totalWeight
        totalSwapVolume
        totalSwapFee
        totalLiquidity
        createTime
        swapsCount
        holdersCount
        tx
        tokensList
        tokens {
          symbol
          name
          address
          weight
          priceRate
          balance
          __typename
        }
        swaps(first: 1, orderBy: timestamp, orderDirection: desc) {
          timestamp
          __typename
        }
        weightUpdates(orderBy: scheduledTimestamp, orderDirection: asc) {
          startTimestamp
          endTimestamp
          startWeights
          endWeights
          __typename
        }
        shares {
          userAddress {
            id
            __typename
          }
          balance
          __typename
        }
        __typename
      }
    }
  `,
}

export const AuctionLayout = () => {
  const [
    request,
    { response, error, isLoading },
  ] = useSubgraphRequest<GraphResponse>(env.subgraph.balancerV2, QUERY);

  useEffect(() => {
    request();
  }, [request]);

  const isAdmin = false;

  const pool = useMemo(() => {
    if (!response?.data?.pools || !response.data.pools.length) {
      return undefined;
    }
    return createPool(response.data.pools[0]);
  }, [response]);

  if (isLoading) {
    return <Loader />;
  }

  if (error) {
    return <>{error}</>;
  }

  return (
    <>
      {isAdmin && (
        <AdminMenuWrapper>
          <PillMenu
            links={[{
              to: '/dapp/ascend',
              label: 'Current',
            }, {
              to: '/dapp/ascend/edit',
              label: 'Edit',
            }, {
              to: '/dapp/ascend/create',
              label: 'Create',
            }]}
          />
        </AdminMenuWrapper>
      )}
      <Outlet context={{ pool }} />
    </>
  );
};

export const useAuctionContext = () => useOutletContext<AuctionContext>();

const AdminMenuWrapper = styled.div`
  margin: 2rem 0 -1rem;
`;