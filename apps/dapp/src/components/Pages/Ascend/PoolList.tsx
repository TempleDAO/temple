import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

import { Head, Table, Row, Cell, Body } from 'components/Table/Table';
import { Button as BaseButton } from 'components/Button/Button';
import { useTemplePools } from 'hooks/ascend';
import Loader from 'components/Loader/Loader';
import { formatNumberFixedDecimals } from 'utils/formatter';

const PoolListPage = () => {
  const [request, { response, error, isLoading }] = useTemplePools();

  useEffect(() => {
    request();
  }, [request]);

  if (isLoading) {
    return <Loader />;
  }

  if (error) {
    return <h3>Error loading pools...</h3>;
  }

  return (
    <div>
      <h2>Pools</h2>
      <Table $expand>
        <Head>
          <Row>
            {/* // TODO: What fields to show? */}
            <Cell as="th">Address</Cell>
            <Cell as="th">Name</Cell>
            <Cell as="th">Tokens</Cell>
            <Cell as="th">Swap Enabled</Cell>
            <Cell as="th">Weights Updated</Cell>
            <Cell as="th">Liquidity</Cell>
            <Cell as="th">Actions</Cell>
          </Row>
        </Head>
        <Body>
          {response?.data?.pools.map((pool) => {
            return (
              <Row key={pool.id}>
                <Cell>{pool.address}</Cell>
                <Cell>{pool.name}</Cell>
                <Cell>
                  {pool.tokens[0].symbol} / {pool.tokens[1].symbol}
                </Cell>
                <Cell>{pool.swapEnabled ? 'YES' : 'NO'}</Cell>
                <Cell>{pool.weightUpdates.length === 1 ? 'NO' : 'YES'}</Cell>
                <Cell>
                  {Number(pool.totalLiquidity) === 0
                    ? 'None'
                    : `$${formatNumberFixedDecimals(pool.totalLiquidity, 4)}`}
                </Cell>
                <Cell>
                  <Link to={`${pool.address}`}>Edit</Link>
                </Cell>
              </Row>
            );
          })}
        </Body>
      </Table>
      <Link to="new">
        <CreateButton isSmall label="Create Pool" />
      </Link>
    </div>
  );
};

const HeaderText = styled.span`
  color: ${({ theme }) => theme.palette.brand};
`;

const CreateButton = styled(BaseButton)<{ $isSmall?: boolean }>`
  border-radius: 0.75rem;
  color: ${({ theme }) => theme.palette.brand};
  border: 1px solid ${({ theme }) => theme.palette.brand};
  margin: 1rem 0 0 0;
  font-size: 2 rem;
  transition: background 0.2s ease-in-out;
`;

export default PoolListPage;
