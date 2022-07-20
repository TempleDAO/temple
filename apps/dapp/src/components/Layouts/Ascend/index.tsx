import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Outlet, useOutletContext, Link } from 'react-router-dom';
import { useNetwork } from 'wagmi';

import { useSubgraphRequest } from 'hooks/use-subgraph-request';
import Loader from 'components/Loader/Loader';
import { PillMenu } from 'components/PillMenu';

import { AuctionContext, GraphResponse } from './types';
import { createPool } from './utils';
import env from 'constants/env';
import { phoneAndAbove } from 'styles/breakpoints';
import { NAV_MOBILE_HEIGHT_PIXELS } from 'components/Layouts/CoreLayout/Header';
import { useTemplePools } from 'components/Pages/Ascend/hooks';

const createLBPQuery = (auctionId: string) => {
  return {
    query: `
      query ($auctionId: String) {
        pools(where: {address: $auctionId, poolType: "LiquidityBootstrapping"}) {
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
    variables: {
      auctionId,
    },
  };
};

export const AscendLayout = () => {
  const [
    request,
    { response, error, isLoading },
  ] = useTemplePools();
  
  useEffect(() => {
    request();
  }, [request]);

  const isAdmin = false;

  const pools = useMemo(() => {
    if (!response?.data?.pools || !response.data.pools.length) {
      return undefined;
    }
    return response.data.pools.map((pool) => createPool(pool));
  }, [response]);

  if (isLoading) {
    return <Loader />;
  }

  if (error) {
    return <>{error.message}</>;
  }
  console.log((pools || [])[0])
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
      <Wrapper>
        <Outlet context={{ pool: (pools || [])[0] }} />
      </Wrapper>
    </>
  );
};

export const useAuctionContext = () => useOutletContext<AuctionContext>();

const AdminMenuWrapper = styled.div`
  margin: 2rem 0 -1rem;
`;

const Wrapper = styled.div`
  margin: ${NAV_MOBILE_HEIGHT_PIXELS}px 10px 10px 10px;

  ${phoneAndAbove(`
    margin: 40px 40px 40px 40px;
  `)}
`;