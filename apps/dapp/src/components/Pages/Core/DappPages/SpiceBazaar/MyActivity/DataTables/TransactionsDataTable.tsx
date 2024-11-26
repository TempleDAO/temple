import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import * as breakpoints from 'styles/breakpoints';

export type Transaction = {
  epoch: string;
  type: 'Bid' | 'Claim';
  transactionLink: string;
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
  refetch,
  dataRefetching,
}) => {
  const [filter, setFilter] = useState('Last 5 Shown');
  const [filteredTransactions, setFilteredTransactions] =
    useState<Transaction[]>(transactions);
  const filterOptions = ['Last 5 Shown', 'Show All'];

  useEffect(() => {
    if (filter === 'Last 5 Shown') {
      setFilteredTransactions(transactions.slice(0, 5));
      // setFilteredTransactions(transactions.slice(-5)); - that's if the last transactions are in end of the array
    } else {
      setFilteredTransactions(transactions);
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
      <TableWrapper>
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
                <DataRow key={transaction.epoch}>
                  <DataCell>{transaction.epoch}</DataCell>
                  <DataCell>{transaction.type}</DataCell>
                  <DataCell>{transaction.transactionLink}</DataCell>
                </DataRow>
              ))
            )}
          </tbody>
        </TableData>
      </TableWrapper>
    </PageContainer>
  );
};

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 40px 0px 24px 0px;
  gap: 20px;

  ${breakpoints.phoneAndAbove(`
    gap: 32px;
  `)}
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

const TableWrapper = styled.div`
  overflow-x: scroll;
  padding-bottom: 20px;
  scrollbar-width: thin;
  scrollbar-color: #58321a #95613f;

  &::-webkit-scrollbar {
    height: 8px;
    background: transparent;
    border-radius: 8px;
  }

  &::-webkit-scrollbar-thumb {
    background: linear-gradient(to right, #58321a 20%, #95613f 84.5%);
    margin: 2px 82px 2px 2px;
  }

  &::-webkit-scrollbar-track {
    border: 1px solid #351f11;
    border-radius: 8px;
  }
`;

const TableData = styled.table`
  border-spacing: 10px
  width: 100%;
  border-collapse: collapse;
  min-width: 500px;
`;

const HeaderRow = styled.tr`
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
`;

const TableHeader = styled.th`
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

const DataRow = styled.tr``;

const DataCell = styled.td`
  font-size: 13px;
  font-weight: 700;
  line-height: 20px;
  text-align: left;
  padding: 20px 0px 20px 0px;
  width: 33.33%;
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
  color: ${({ theme }) => theme.palette.brandLight};
`;
