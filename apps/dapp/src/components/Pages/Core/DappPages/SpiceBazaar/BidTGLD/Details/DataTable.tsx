import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Transaction } from './Table';
import { PaginationControl } from 'components/Pages/Core/DappPages/SpiceBazaar/components/PaginationControl';
import * as breakpoints from 'styles/breakpoints';

enum TableHeaders {
  Epoch = 'EPOCH',
  Status = 'Status',
  AuctionStartDate = 'Auction Start Date',
  AuctionEndDate = 'Auction End Date',
  AmountTGLDAuctioned = 'Amount TGLD Auctioned',
  PriceRatio = 'Price Ratio',
}

type TableProps = {
  transactions: Transaction[];
  loading: boolean;
  refetch?: () => void;
  dataRefetching?: boolean;
};

const ROWS_PER_PAGE = 4;

export const DataTable: React.FC<TableProps> = ({
  transactions,
  loading,
  refetch,
  dataRefetching,
}) => {
  const tableHeaders = [
    { name: TableHeaders.Epoch },
    { name: TableHeaders.Status },
    { name: TableHeaders.AuctionStartDate },
    { name: TableHeaders.AuctionEndDate },
    { name: TableHeaders.AmountTGLDAuctioned },
    { name: TableHeaders.PriceRatio },
  ];

  const [filter, setFilter] = useState('Last 30 Days');
  const [filteredTransactions, setFilteredTransactions] =
    useState<Transaction[]>(transactions);
  const [currentPage, setCurrentPage] = useState(1);

  const filterOptions = ['Last Week', 'Last 30 Days', 'All'];

  useEffect(() => {
    const newFilteredTransactions = transactions.filter((transaction) => {
      const auctionEndDate = new Date(transaction.auctionStartDate);
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
            ) : currentTransactions.length === 0 ? (
              <DataRow>
                <DataCell colSpan={6}>No data available</DataCell>
              </DataRow>
            ) : (
              currentTransactions.map((transaction) => (
                <DataRow key={transaction.epoch}>
                  <DataCell>{transaction.epoch}</DataCell>
                  <DataCell>{transaction.status}</DataCell>
                  <DataCell>
                    {transaction.status !== 'Not yet started'
                      ? transaction.auctionStartDate
                      : '-'}
                  </DataCell>
                  <DataCell>
                    {transaction.status === 'Finished'
                      ? transaction.auctionEndDate
                      : '-'}
                  </DataCell>
                  <DataCell>{transaction.amountTGLD}</DataCell>
                  <DataCell>
                    {transaction.status === 'Finished'
                      ? transaction.priceRatio
                      : '-'}
                  </DataCell>
                </DataRow>
              ))
            )}
          </tbody>
        </TableData>
      </TableWrapper>
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
  padding-top: 5px;
  color: ${({ theme }) => theme.palette.brand};
  position: sticky;
  top: 0;
  z-index: 1;
`;

const DataRow = styled.tr`
  padding-left: 16px;
`;

const DataCell = styled.td`
  font-size: 13px;
  font-weight: 700;
  line-height: 20px;
  text-align: left;
  padding: 20px 0px 20px 0px;
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
  color: ${({ theme }) => theme.palette.brandLight};

  &:first-child {
    padding-left: 16px;
  }
`;
