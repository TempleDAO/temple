import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { PaginationControl } from 'components/Pages/Core/DappPages/SpiceBazaar/components/PaginationControl';
import { Transaction } from '../hooks/use-bids-history';
import * as breakpoints from 'styles/breakpoints';
import { ScrollBar } from 'components/Pages/Core/DappPages/SpiceBazaar/components/CustomScrollBar';

enum TableHeaders {
  KekID = 'KEK ID',
  DateStarted = 'Date started',
  DateEnded = 'Date ended',
  TokenName = 'Token name',
  LotSize = 'Lot size',
  TotalTGLDBid = 'Total TGLD bid',
  FinalPrice = 'Final price',
}

type TableProps = {
  transactions: Transaction[];
  loading: boolean;
  refetch?: () => void;
  dataRefetching?: boolean;
};

const ROWS_PER_PAGE = 5;

export const DataTable: React.FC<TableProps> = ({ transactions, loading }) => {
  const tableHeaders = [
    { name: TableHeaders.KekID },
    { name: TableHeaders.DateStarted },
    { name: TableHeaders.DateEnded },
    { name: TableHeaders.TokenName },
    { name: TableHeaders.LotSize },
    { name: TableHeaders.TotalTGLDBid },
    { name: TableHeaders.FinalPrice },
  ];
  // const [modal, setModal] = useState<'closed' | 'bidTgld'>('closed');
  const [filter, setFilter] = useState('Last 30 Days');
  const [filteredTransactions, setFilteredTransactions] =
    useState<Transaction[]>(transactions);
  const [currentPage, setCurrentPage] = useState(1);

  const filterOptions = ['Last Week', 'Last 30 Days', 'All'];

  useEffect(() => {
    const sortedTransactions = [...transactions].sort(
      (a, b) => Number(b.dateEnded) - Number(a.dateStarted)
    );

    const today = new Date();
    const todayUnix = today.getTime().toString();

    const getStartOfPeriod = (daysAgo: number) => {
      const start = new Date();
      start.setDate(today.getDate() - daysAgo);
      return start.getTime().toString();
    };

    const newFilteredTransactions = sortedTransactions.filter((transaction) => {
      if (filter === 'Last Week') {
        return (
          transaction.dateStarted >= getStartOfPeriod(7) &&
          transaction.dateEnded <= todayUnix
        );
      }
      if (filter === 'Last 30 Days') {
        return (
          transaction.dateStarted >= getStartOfPeriod(30) &&
          transaction.dateEnded <= todayUnix
        );
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
        <Title>Auctions History</Title>
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
            ) : currentTransactions.length === 0 ? (
              <DataRow>
                <DataCell colSpan={6}>No data available</DataCell>
              </DataRow>
            ) : (
              currentTransactions.map((transaction) => {
                return (
                  <DataRow key={transaction.kekId}>
                    <DataCell>{transaction.kekId}</DataCell>
                    <DataCell>
                      {new Date(
                        Number(transaction.dateStarted) * 1000
                      ).toLocaleDateString('en-GB')}
                    </DataCell>
                    <DataCell>
                      {new Date(
                        Number(transaction.dateEnded) * 1000
                      ).toLocaleDateString('en-GB')}
                    </DataCell>
                    <DataCell>{transaction.tokenName}</DataCell>
                    <DataCell>{transaction.lotSize} Unit</DataCell>
                    <DataCell>{transaction.totalTgldBid} TGLD</DataCell>
                    <DataCell>{transaction.finalPrice} TGLD</DataCell>
                  </DataRow>
                );
              })
            )}
          </tbody>
        </TableData>
      </ScrollBar>
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
  gap: 20px;

  ${breakpoints.phoneAndAbove(`
    gap: 10px;
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

const TableData = styled.table`
  border-spacing: 10px;
  min-width: 980px;
  border-collapse: collapse;
  width: 100%;
`;

const HeaderRow = styled.tr`
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
`;

const TableHeader = styled.th`
  font-size: 13px;
  font-weight: 700;
  line-height: 20px;
  text-align: left;
  color: ${({ theme }) => theme.palette.brand};
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 20px 16px;

  &:first-child {
    padding: 20px 16px 20px 0px;
  }

  &:last-child {
    padding: 20px 0px 20px 16px;
  }
`;

const DataRow = styled.tr`
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
`;

const DataCell = styled.td`
  font-size: 13px;
  font-weight: 700;
  line-height: 20px;
  text-align: left;
  padding: 20px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
  color: ${({ theme }) => theme.palette.brandLight};
  max-width: 170px;

  &:first-child {
    padding: 20px 16px 20px 0px;
  }

  &:last-child {
    padding: 20px 0px 20px 16px;
  }
`;
