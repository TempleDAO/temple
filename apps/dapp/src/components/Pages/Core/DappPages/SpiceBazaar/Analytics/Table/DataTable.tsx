import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { PaginationControl } from 'components/Pages/Core/DappPages/SpiceBazaar/components/PaginationControl';
import * as breakpoints from 'styles/breakpoints';

export type Transaction = {
  key: number;
  date: string;
  debit: number | '-';
  credit: number | '-';
};

type TableHeaderType = { name: string };

type TableProps = {
  tableHeaders: TableHeaderType[];
  transactions: Transaction[];
  loading: boolean;
  refetch?: () => void;
  dataRefetching?: boolean;
};

const ROWS_PER_PAGE = 15;

export const DataTable: React.FC<TableProps> = ({
  tableHeaders,
  transactions,
  loading,
  refetch,
  dataRefetching,
}) => {
  const [filter, setFilter] = useState('Last 30 Days');
  const [filteredTransactions, setFilteredTransactions] =
    useState<Transaction[]>(transactions);
  const [currentPage, setCurrentPage] = useState(1);

  const filterOptions = ['Last Week', 'Last 30 Days', 'All'];

  useEffect(() => {
    const parseDate = (dateString: string): Date => {
      const [day, month, year] = dateString.split('/').map(Number);
      return new Date(year, month - 1, day);
    };

    const newFilteredTransactions = transactions.filter((transaction) => {
      const auctionEndDate = parseDate(transaction.date); // Parse the date using DD/MM/YYYY format

      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);

      if (filter === 'Last Week') {
        const startOfWeek = new Date();
        startOfWeek.setDate(today.getDate() - today.getDay());
        return auctionEndDate >= startOfWeek && auctionEndDate <= today;
      }
      if (filter === 'Last 30 Days') {
        return auctionEndDate >= thirtyDaysAgo && auctionEndDate <= today;
      }
      return true;
    });

    setFilteredTransactions(newFilteredTransactions);
    setCurrentPage(1);
  }, [filter, transactions]);

  const indexOfLastTransaction = currentPage * ROWS_PER_PAGE;
  const indexOfFirstTransaction = indexOfLastTransaction - ROWS_PER_PAGE;
  const currentTransactions = filteredTransactions.slice(
    indexOfFirstTransaction,
    indexOfLastTransaction
  );

  const totalPages = Math.ceil(filteredTransactions.length / ROWS_PER_PAGE);

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
          ) : currentTransactions.length === 0 ? (
            <DataRow>
              <DataCell colSpan={6}>No data available</DataCell>
            </DataRow>
          ) : (
            currentTransactions.map((transaction) => (
              <DataRow key={transaction.key}>
                <DataCell>{transaction.date}</DataCell>
                <DataCell>
                  {transaction.debit !== '-'
                    ? `$${Number(transaction.debit).toFixed(2)}`
                    : ''}
                </DataCell>
                <DataCell>
                  {transaction.credit !== '-'
                    ? `$${Number(transaction.credit).toFixed(2)}`
                    : ''}
                </DataCell>
              </DataRow>
            ))
          )}
        </tbody>
      </TableData>
      <PaginationControl
        totalPages={totalPages}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
      />
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
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
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
  background: none;
  color: ${({ selected, theme }) =>
    selected ? theme.palette.brandLight : theme.palette.brand};
  font-size: 16px;
  line-height: 19px;
  border: none;
  cursor: pointer;
`;

const TableData = styled.table`
  border-spacing: 10px;
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

const DataRow = styled.tr`
  &:hover {
    background: ${({ theme }) => theme.palette.gradients.grey};
  }
`;

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
