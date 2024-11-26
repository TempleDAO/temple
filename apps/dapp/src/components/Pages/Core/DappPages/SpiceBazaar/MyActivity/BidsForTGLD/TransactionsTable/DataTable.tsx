import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Transaction } from './Table';

enum TableHeaders {
  Epoch = 'EPOCH',
  Type = 'Type',
  TransactionLink = 'Transaction Link',
}

type TableProps = {
  transactions: Transaction[];
  loading: boolean;
  refetch?: () => void;
  dataRefetching?: boolean;
};

export const DataTable: React.FC<TableProps> = ({
  transactions,
  loading,
  refetch,
  dataRefetching,
}) => {
  const tableHeaders = [
    { name: TableHeaders.Epoch },
    { name: TableHeaders.Type },
    { name: TableHeaders.TransactionLink },
  ];

  const [filter, setFilter] = useState('Last 5 Shown');
  const [filteredTransactions, setFilteredTransactions] =
    useState<Transaction[]>(transactions);

  const filterOptions = ['Last 5 Shown', 'Show All'];

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
          ) : transactions.length === 0 ? (
            <DataRow>
              <DataCell colSpan={6}>No data available</DataCell>
            </DataRow>
          ) : (
            transactions.map((transaction) => (
              <DataRow key={transaction.epoch}>
                <DataCell>{transaction.epoch}</DataCell>
                <DataCell>{transaction.type}</DataCell>
                <DataCell>{transaction.transactionLink}</DataCell>
              </DataRow>
            ))
          )}
        </tbody>
      </TableData>
    </PageContainer>
  );
};

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 40px 0px 24px 0px;
  gap: 32px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Title = styled.h3`
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 24px;
  line-height: 44px;
  font-weight: 400;
  margin: 0;
`;

const FilterContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: 20px;
`;

const FilterButton = styled.button<{ selected: boolean }>`
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
