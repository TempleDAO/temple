import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { PaginationControl } from 'components/Pages/Core/DappPages/SpiceBazaar/components/PaginationControl';
import { Transaction } from './Table';
import { BidTGLD } from '../BidTGLD';
import { Popover } from 'components/Pages/Core/DappPages/SpiceBazaar/components/Popover';
import { Button } from 'components/Button/Button';
import * as breakpoints from 'styles/breakpoints';
import active from 'assets/icons/active_auc.svg?react';
import scheduled from 'assets/icons/scheduled_auc.svg?react';
import closed from 'assets/icons/closed.svg?react';
import { ScrollBar } from 'components/Pages/Core/DappPages/SpiceBazaar/components/CustomScrollBar';

enum TableHeaders {
  Status = 'Status',
  AuctionName = 'Auction Name',
  TotalVolume = 'Total Volume',
  FloorPrice = 'Floor Price',
  BestOffer = 'Best Offer',
  Links = '',
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
    { name: TableHeaders.Status },
    { name: TableHeaders.AuctionName },
    { name: TableHeaders.TotalVolume },
    { name: TableHeaders.FloorPrice },
    { name: TableHeaders.BestOffer },
    { name: TableHeaders.Links },
  ];
  const [modal, setModal] = useState<'closed' | 'bidTgld'>('closed');
  const [filter, setFilter] = useState('Last 30 Days');
  const [filteredTransactions, setFilteredTransactions] =
    useState<Transaction[]>(transactions);
  const [currentPage, setCurrentPage] = useState(1);

  const navigate = useNavigate();

  const filterOptions = ['Last Week', 'Last 30 Days', 'All'];

  useEffect(() => {
    const newFilteredTransactions = transactions.filter((transaction) => {
      // Extracting the date from the status string
      const statusParts = transaction.status.split(' at ');
      const auctionEndDateString = statusParts[statusParts.length - 1]; // Geting the last part which contains the date
      const auctionEndDate = new Date(auctionEndDateString);

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
    <>
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
                currentTransactions.map((transaction) => (
                  <DataRow key={transaction.auctionName}>
                    {(() => {
                      if (transaction.status.includes('Closed')) {
                        return (
                          <DataCell>
                            <Status>
                              <Closed /> {transaction.status}
                            </Status>
                          </DataCell>
                        );
                      } else if (transaction.status.includes('Upcoming')) {
                        return (
                          <DataCell>
                            <Status>
                              <Scheduled /> {transaction.status}
                            </Status>
                          </DataCell>
                        );
                      } else if (transaction.status.includes('Ends')) {
                        return (
                          <DataCell>
                            <Status>
                              <Active /> {transaction.status}
                            </Status>
                          </DataCell>
                        );
                      }
                    })()}
                    <DataCell>{transaction.auctionName}</DataCell>
                    <DataCell>{transaction.totalVolume} ETH</DataCell>
                    <DataCell>{transaction.floorPrice} TGLD</DataCell>
                    <DataCell>{transaction.bestOffer} TGLD</DataCell>
                    <DataCell>
                      <ButtonsContainer>
                        <TradeButton
                          onClick={() => navigate(transaction.details)}
                          style={{ whiteSpace: 'nowrap', margin: 0 }}
                        >
                          Details
                        </TradeButton>
                        <TradeButton
                          onClick={() => setModal('bidTgld')}
                          style={{ whiteSpace: 'nowrap', margin: 0 }}
                          disabled={
                            transaction.status.includes('Ends') ? false : true
                          }
                        >
                          BID
                        </TradeButton>
                      </ButtonsContainer>
                    </DataCell>
                  </DataRow>
                ))
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
      <Popover
        isOpen={modal != 'closed'}
        onClose={() => setModal('closed')}
        closeOnClickOutside
        showCloseButton
      >
        <BidTGLD />
      </Popover>
    </>
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
  padding: 20px 16px;

  &:first-child {
    padding: 20px 16px 20px 0px;
  }

  &:last-child {
    padding: 20px 0px 20px 16px;
  }
`;

const DataRow = styled.tr``;

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

const ButtonsContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  width: 100%;
`;

const TradeButton = styled(Button)`
  padding: 10px 20px;
  width: auto;
  height: min-content;
  background: linear-gradient(90deg, #58321a 20%, #95613f 84.5%);
  border: ${({ disabled, theme }) =>
    disabled ? 'none' : `1px solid ${theme.palette.brandDark}`};
  box-shadow: ${({ disabled }) =>
    disabled ? 'none' : '0px 0px 20px 0px #DE5C0666'};
  border-radius: 10px;
  font-weight: 700;
  font-size: 12px;
  line-height: 20px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const Status = styled.td`
  display: flex;
  align-items: center;
`;

const Active = styled(active)``;

const Scheduled = styled(scheduled)``;

const Closed = styled(closed)``;
