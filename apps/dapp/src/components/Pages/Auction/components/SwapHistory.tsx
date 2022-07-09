import { useEffect } from 'react';
import { format } from 'date-fns';

import { useAuctionContext } from 'components/Layouts/Auction';
import { UnstyledList } from 'styles/common';
import { formatBigNumber } from 'components/Vault/utils';
import { formatNumberFixedDecimals } from 'utils/formatter';
import { useSubgraphRequest } from 'hooks/use-subgraph-request';
import { Pool } from 'components/Layouts/Auction/types';
import env from 'constants/env';
import { SubGraphQuery, SubGraphResponse, SubgraphError } from 'hooks/core/types';
import Loader from 'components/Loader/Loader';
import TruncatedAddress from 'components/TruncatedAddress';

const createSwapQuery = (auctionId: string, before: number, first = 10, skip = 0) => ({
  query: `
    query ($auctionId: String, $first: Int, $skip: Int, $before: Int) {
      swaps(
        first: $first,
        skip: $skip,
        orderBy: timestamp,
        orderDirection: desc,
        where: {poolId: $auctionId, timestamp_lt: $before}
      ) {
        tx
        tokenIn
        tokenInSym
        tokenOut
        tokenOutSym
        tokenAmountIn
        tokenAmountOut
        timestamp
        userAddress {
          id
          __typename
        }
        __typename
      }
    }
  `,
  variables: {
    auctionId,
    before,
    first,
    skip,
  },
});

type SwapResponse = SubGraphResponse<{
  swaps: {
    tx: string;
    tokenIn: string;
    tokenInSym: string;
    tokenOut: string;
    tokenOutSym: string;
    tokenAmountIn: string;
    tokenAmountOut: string;
    timestamp: number;
    userAddress: {
      id: string;
    };
  }[];
}>;

const useSwapHistory = (pool: Pool) => {
  const lastUpdate = pool.weightUpdates[pool.weightUpdates.length - 1];
  const auctionEndSeconds = Number(lastUpdate.endTimestamp) / 1000;

  return useSubgraphRequest<SwapResponse>(
    env.subgraph.balancerV2, createSwapQuery(pool.id, auctionEndSeconds));
};

interface Props {
  pool: Pool;
}

export const SwapHistory = ({ pool }: Props) => {
  const [request, { response, isLoading, error }] = useSwapHistory(pool);

  useEffect(() => {
    request();
  }, [request]);

  if (isLoading) {
    return <Loader />;
  }

  if (error) {
    return <>Something went wrong...</>;
  }

  const mainToken = pool.tokens[0].symbol;
  const swaps = response?.data?.swaps || [];

  return (
    <div>
      <h3>Transaction Log</h3>
      <table cellPadding={10}>
        <thead>
          <tr>
            <th>
              Time
            </th>
            <th>
              Type
            </th>
            <th>
              Input
            </th>
            <th>
              Output
            </th>
            <th>
              Price
            </th>
            <th>
              Wallet
            </th>
          </tr>
        </thead>
        <tbody>
          {swaps.map((swap) => {
            const isSell = swap.tokenInSym === mainToken;
            const price = isSell ? 
              formatNumberFixedDecimals(Number(swap.tokenAmountOut) / Number(swap.tokenAmountIn), 4) :
              formatNumberFixedDecimals(Number(swap.tokenAmountIn) / Number(swap.tokenAmountOut), 4);

            return (
              <tr key={swap.tx}>
                <td>
                  {format(swap.timestamp * 1000, 'LLL d, yyyy h:mm a')}
                </td>
                <td>
                  {isSell ? 'sell' : 'buy'}
                </td>
                <td>
                  {formatNumberFixedDecimals(swap.tokenAmountIn, 4)} {swap.tokenInSym}
                </td>
                <td>
                  {formatNumberFixedDecimals(swap.tokenAmountOut, 4)} {swap.tokenOutSym}
                </td>
                <td>
                  {price}
                </td>
                <td>
                  <TruncatedAddress address={swap.userAddress.id} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
