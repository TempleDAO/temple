import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { useEffect } from 'react';

import { Head, Table, Row, Cell, Body } from 'components/Table/Table';
import { Button as BaseButton } from 'components/Button/Button';

import { useTemplePools } from './hooks';

const PoolListPage = () => {

  const [request, {response}] = useTemplePools();
  
  useEffect(() => {
    request();
  }, [request]);

  console.log(response)

  const pools = [
    {
      id: 1,
      name: 'foo',
      prop: 'bar',
    },
    {
      id: 2,
      name: 'foo',
      prop: 'bar',
    },
    {
      id: 3,
      name: 'foo',
      prop: 'bar',
    },
  ];

  return (
    <div>
      <h2>Pools</h2>
      <Table $expand>
        <Head>
          <Row>
            <Cell as="th">Pool ID</Cell>
            <Cell as="th">Pool Name</Cell>
            <Cell as="th">Pool Prop</Cell>
            <Cell as="th">Actions</Cell>
          </Row>
        </Head>
        <Body>
          {pools.map((pool) => {
            return (
              <Row key={pool.id}>
                <Cell>{pool.id}</Cell>
                <Cell>{pool.name}</Cell>
                <Cell>{pool.prop}</Cell>
                <Cell><Link to={`${pool.id}`}>Edit</Link></Cell>
              </Row>
            );
          })}
        </Body>
      </Table>
      <Link to="admin/new">
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
