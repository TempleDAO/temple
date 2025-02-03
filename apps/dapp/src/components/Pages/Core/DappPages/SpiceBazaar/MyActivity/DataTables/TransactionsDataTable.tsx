import env from 'constants/env';
import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import * as breakpoints from 'styles/breakpoints';
import { ScrollBar } from 'components/Pages/Core/DappPages/SpiceBazaar/components/CustomScrollBar';

export type Transaction = {
  id: string;
  epoch: string;
  type: string;
  transactionLink: string;
  transactionHash: string;
};

type TableHeader = { name: string };

type TableProps = {
  tableHeaders: TableHeader[];
  transactions: Transaction[];
  loading: boolean;
  refetch?: () => void;
  dataRefetching?: boolean;
};

export const DataTable: React.FC<TableProps> = ({
  tableHeaders,
  transactions,
  loading,
}) => {
  const [filter, setFilter] = useState('Last 5 Shown');
  const [filteredTransactions, setFilteredTransactions] =
    useState<Transaction[]>(transactions);
  const filterOptions = ['Last 5 Shown', 'Show All'];

  useEffect(() => {
    const sortedTransactions = [...transactions].sort(
      (a, b) => Number(b.epoch) - Number(a.epoch)
    );

    if (filter === 'Last 5 Shown') {
      setFilteredTransactions(sortedTransactions.slice(0, 5));
    } else {
      setFilteredTransactions(sortedTransactions);
    }
  }, [filter, transactions]);

  return (
    <PageContainer>
      <Header>
        <Title>Transaction History</Title>
        <FilterContainer>
          {filterOptions.map((option) => (
            <FilterButton
              key={option}
              onClick={() => setFilter(option)}
              selected={filter === option}
            >
              {option}
            </FilterButton>
          ))}
        </FilterContainer>
      </Header>
      <ScrollBar autoHide={false}>
        <TableData>
          <thead>
            <HeaderRow>
              {tableHeaders.map((h) => (
                <TableHeader key={h.name}>{h.name}</TableHeader>
              ))}
            </HeaderRow>
          </thead>
          <tbody>
            {loading ? (
              <DataRow>
                <DataCell colSpan={6}>Loading...</DataCell>
              </DataRow>
            ) : filteredTransactions.length === 0 ? (
              <DataRow>
                <DataCell colSpan={6}>No data available</DataCell>
              </DataRow>
            ) : (
              filteredTransactions.map((transaction) => (
                <DataRow key={transaction.id}>
                  <DataCell>
                    {new Date(
                      Number(transaction.epoch) * 1000
                    ).toLocaleDateString('en-GB')}
                  </DataCell>
                  <DataCell>{transaction.type}</DataCell>
                  <DataCell>
                    <a
                      target="_blank"
                      rel="noreferrer"
                      href={`${env.etherscan}/tx/${transaction.transactionHash}`}
                    >
                      {transaction.transactionLink}
                    </a>
                  </DataCell>
                </DataRow>
              ))
            )}
          </tbody>
        </TableData>
      </ScrollBar>
    </PageContainer>
  );
};

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 40px 0px 24px 0px;
  gap: 20px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-direction: column;
  gap: 10px;

  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
  `)}
`;

const Title = styled.h3`
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 24px;
  line-height: 44px;
  margin: 0;
`;

const FilterContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: 20px;
  padding-right: 16px;
`;

const FilterButton = styled.button<{ selected: boolean }>`
  font-size: 16px;
  line-height: 19px;
  background: none;
  color: ${({ selected, theme }) =>
    selected ? theme.palette.brandLight : theme.palette.brand};
  border: none;
  cursor: pointer;
`;

const TableData = styled.table`
  border-spacing: 10px
  width: 100%;
  border-collapse: collapse;
  min-width: 500px;
  width: 100%;
`;

const HeaderRow = styled.tr`
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
`;

const TableHeader = styled.th`
  padding: 20px 0px;
  font-size: 13px;
  font-weight: 700;
  line-height: 20px;
  text-align: left;
  padding-top: 5px;
  width: 33.33%;
  color: ${({ theme }) => theme.palette.brand};
  position: sticky;
  top: 0;
  z-index: 1;
`;

const DataRow = styled.tr`
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
`;

const DataCell = styled.td`
  font-size: 13px;
  font-weight: 700;
  line-height: 20px;
  text-align: left;
  padding: 20px 0px;
  width: 33.33%;
  color: ${({ theme }) => theme.palette.brandLight};

  a {
    color: ${({ theme }) => theme.palette.brandLight};
  }

  a:hover {
    color: ${({ theme }) => theme.palette.brand};
  }
`;
