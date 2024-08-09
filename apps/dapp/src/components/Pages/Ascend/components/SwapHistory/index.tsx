import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import styled from 'styled-components';

import { formatNumberFixedDecimals } from 'utils/formatter';
import { useSubgraphRequest } from 'hooks/use-subgraph-request';
import { Pool } from 'components/Layouts/Ascend/types';
import env from 'constants/env';
import { SubGraphResponse } from 'hooks/core/types';
import { tabletAndAbove } from 'styles/breakpoints';
import Loader from 'components/Loader/Loader';
import TruncatedAddress from 'components/TruncatedAddress';
import { buttonResets } from 'styles/mixins';

const SWAPS_PER_PAGE = 10;

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

const createSwapQuery = (
  auctionId: string,
  before: number,
  first = SWAPS_PER_PAGE,
  skip = 0
) => ({
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

const useSwapHistory = (pool: Pool, page = 1) => {
  const lastUpdate = pool.weightUpdates[pool.weightUpdates.length - 1];
  const auctionEndSeconds = Number(lastUpdate.endTimestamp) / 1000;
  const offset = (page - 1) * SWAPS_PER_PAGE;

  const query = createSwapQuery(
    pool.id,
    auctionEndSeconds,
    SWAPS_PER_PAGE,
    offset
  );
  return useSubgraphRequest<SwapResponse>(env.subgraph.balancerV2, query);
};

interface Props {
  pool: Pool;
}

export const SwapHistory = ({ pool }: Props) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [request, { response, isLoading, error }] = useSwapHistory(
    pool,
    currentPage
  );

  useEffect(() => {
    request();
  }, [request, currentPage]);

  // First load
  if (!response && isLoading) {
    return <Loader />;
  }

  if (error) {
    return <h3>Error loading swap history...</h3>;
  }

  const mainToken = pool.tokens[0].address;
  const swaps = response?.data?.swaps || [];
  const swapCount = Number(pool.swapsCount || 0);
  const totalPages = Math.ceil(swapCount / SWAPS_PER_PAGE);

  return (
    <div>
      <h3>Transaction Log</h3>
      <Table>
        <THead>
          <tr>
            <th>Time</th>
            <th className="hidden">Type</th>
            <th className="hidden">Input</th>
            <th>Output</th>
            <th>Price</th>
            <th className="hidden">Transaction</th>
          </tr>
        </THead>
        <tbody>
          {swaps.map((swap) => {
            const isSell = swap.tokenIn === mainToken;
            const price = isSell
              ? formatNumberFixedDecimals(
                  Number(swap.tokenAmountOut) / Number(swap.tokenAmountIn),
                  4
                )
              : formatNumberFixedDecimals(
                  Number(swap.tokenAmountIn) / Number(swap.tokenAmountOut),
                  4
                );

            return (
              <tr key={swap.tx}>
                <td>{format(swap.timestamp * 1000, 'LLL d, yyyy h:mm a')}</td>
                <td className="hidden">{isSell ? 'sell' : 'buy'}</td>
                <td className="hidden">
                  {formatNumberFixedDecimals(swap.tokenAmountIn, 4)}{' '}
                  {swap.tokenInSym}
                </td>
                <td>
                  {formatNumberFixedDecimals(swap.tokenAmountOut, 4)}{' '}
                  {swap.tokenOutSym}
                </td>
                <td>{price}</td>
                <td className="hidden">
                  <Link
                    href={`${env.etherscan}/tx/${swap.tx}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    <TruncatedAddress address={swap.tx} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {totalPages > 0 && (
        <>
          <PagingButton
            onClick={() => {
              setCurrentPage((current) => current - 1);
            }}
            disabled={currentPage <= 1}
          >
            Prev Page
          </PagingButton>
          <PagingButton
            onClick={() => {
              setCurrentPage((current) => current + 1);
            }}
            disabled={currentPage === totalPages}
          >
            Next Page
          </PagingButton>
        </>
      )}
    </div>
  );
};

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  border: 1px solid ${({ theme }) => theme.palette.brand75};
  margin-bottom: 1rem;

  th,
  td {
    padding: 0.75rem;
  }

  .hidden {
    display: none;

    ${tabletAndAbove(`
      display: table-cell;
    `)}
  }

  td {
    border: 1px solid ${({ theme }) => theme.palette.brand75};
  }
`;

const THead = styled.thead`
  background-color: ${({ theme }) => theme.palette.brand75};

  th {
    text-align: left;
  }
`;

const PagingButton = styled.button`
  ${buttonResets}

  color: ${({ theme }) => theme.palette.brand};
  background: transparent;

  &:disabled {
    color: ${({ theme }) => theme.palette.brand50};
  }
`;

const Link = styled.a`
  font-weight: 400;
  color: ${({ theme }) => theme.palette.light};
`;
