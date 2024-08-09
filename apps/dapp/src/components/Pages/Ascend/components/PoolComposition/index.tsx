import styled from 'styled-components';

import { tabletAndAbove } from 'styles/breakpoints';
import { useAuctionContext } from '../AuctionContext';
import { formatNumberFixedDecimals, truncateDecimals } from 'utils/formatter';
import { DBN_ZERO } from 'utils/DecimalBigNumber';

export const PoolComposition = () => {
  const { base, accrued, weights, balances } = useAuctionContext();

  return (
    <>
      <h3>Pool Composition</h3>
      <Wrapper>
        <THead>
          <tr>
            <th>Token</th>
            <th>Weight</th>
            <th>Balance</th>
          </tr>
        </THead>
        <tbody>
          <tr>
            <td>{accrued.symbol}</td>
            <td>
              {truncateDecimals(
                formatNumberFixedDecimals(
                  (weights[accrued.address as any] || DBN_ZERO).formatUnits()
                ) * 100,
                2
              )}
              %
            </td>
            <td>
              {formatNumberFixedDecimals(
                (balances[accrued.address as any] || DBN_ZERO).formatUnits(),
                4
              )}
            </td>
          </tr>
          <tr>
            <td>{base.symbol}</td>
            <td>
              {truncateDecimals(
                formatNumberFixedDecimals(
                  (weights[base.address as any] || DBN_ZERO).formatUnits()
                ) * 100,
                2
              )}
              %
            </td>
            <td>
              {formatNumberFixedDecimals(
                (balances[base.address as any] || DBN_ZERO).formatUnits(),
                4
              )}
            </td>
          </tr>
        </tbody>
      </Wrapper>
    </>
  );
};

const Wrapper = styled.table`
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
