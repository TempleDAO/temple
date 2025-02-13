import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { PaginationControl } from 'components/Pages/Core/DappPages/SpiceBazaar/components/PaginationControl';
import { Transaction } from '../hooks/use-bids-history';
import { BidTGLD, BidTGLDMode } from '../BidTGLD';
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
    const sortedTransactions = [...transactions].sort(
      (a, b) => Number(b.startTime) - Number(a.startTime)
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
          transaction.startTime >= getStartOfPeriod(7) &&
          transaction.startTime <= todayUnix
        );
      }
      if (filter === 'Last 30 Days') {
        return (
          transaction.startTime >= getStartOfPeriod(30) &&
          transaction.startTime <= todayUnix
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

  const formatAuctionStatus = (startTime: string, endTime: string): string => {
    const now = Math.floor(Date.now() / 1000);
    const start = Number(startTime);
    const end = Number(endTime);
    const formattedEndTime = new Date((end as any) * 1000);

    if (start > now) {
      return `Upcoming ${formattedEndTime.toLocaleDateString()} ${formattedEndTime.toLocaleTimeString()}`;
    } else if (end > now) {
      const timeRemaining = end - now;
      const days = Math.floor(timeRemaining / 86400);
      const hours = Math.floor((timeRemaining % 86400) / 3600);
      const minutes = Math.floor((timeRemaining % 3600) / 60);
      const seconds = timeRemaining % 60;

      return `Ends in ${days > 0 ? `${days}d ` : ''}${String(hours).padStart(
        2,
        '0'
      )}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
        2,
        '0'
      )} at 
      ${formattedEndTime.toLocaleDateString()} ${formattedEndTime.toLocaleTimeString()}`;
    } else {
      return `Closed at ${formattedEndTime.toLocaleDateString()} ${formattedEndTime.toLocaleTimeString()}`;
    }
  };

  const getButtonState = (startTime: string, endTime: string) => {
    const now = Math.floor(Date.now() / 1000);
    const start = Number(startTime);
    const end = Number(endTime);

    const isUpcoming = start > now;
    const isActive = end > now && start <= now;
    const isClosed = end <= now;

    return {
      isActive,
      isUpcoming,
      isClosed,
      detailsEnabled: isActive || isClosed,
      bidEnabled: isActive,
    };
  };

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
                currentTransactions.map((transaction) => {
                  const formattedStatus = formatAuctionStatus(
                    transaction.startTime,
                    transaction.endTime
                  );
                  const { detailsEnabled, bidEnabled } = getButtonState(
                    transaction.startTime,
                    transaction.endTime
                  );

                  return (
                    <DataRow key={transaction.auctionName}>
                      <DataCell>
                        <Status>
                          <StatusIcon>
                            {formattedStatus.includes('Closed') && <Closed />}
                            {formattedStatus.includes('Upcoming') && (
                              <Scheduled />
                            )}
                            {formattedStatus.includes('Ends') && <Active />}
                          </StatusIcon>
                          <StatusText>
                            {formattedStatus.split(' at ')[0]} <br />
                            {formattedStatus.includes('at') &&
                              `at ${formattedStatus.split(' at ')[1]}`}
                          </StatusText>
                        </Status>
                      </DataCell>
                      <DataCell>{transaction.auctionName}</DataCell>
                      <DataCell>{transaction.totalVolume} ETH</DataCell>
                      <DataCell>{transaction.floorPrice} TGLD</DataCell>
                      <DataCell>{transaction.bestOffer} TGLD</DataCell>
                      <DataCell>
                        <ButtonsContainer>
                          <TradeButton
                            onClick={() => navigate(transaction.details)}
                            style={{ whiteSpace: 'nowrap', margin: 0 }}
                            disabled={!detailsEnabled}
                          >
                            Details
                          </TradeButton>
                          <TradeButton
                            onClick={() => setModal('bidTgld')}
                            style={{ whiteSpace: 'nowrap', margin: 0 }}
                            disabled={!bidEnabled}
                          >
                            BID
                          </TradeButton>
                        </ButtonsContainer>
                      </DataCell>
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
      <Popover
        isOpen={modal != 'closed'}
        onClose={() => setModal('closed')}
        closeOnClickOutside
        showCloseButton
      >
        <BidTGLD mode={BidTGLDMode.Bid} />
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
  background: ${({ theme }) => theme.palette.gradients.dark};
  border: ${({ disabled, theme }) =>
    disabled ? 'none' : `1px solid ${theme.palette.brandDark}`};
  box-shadow: ${({ disabled }) =>
    disabled ? 'none' : '0px 0px 20px 0px rgba(222, 92, 6, 0.4)'};
  border-radius: 10px;
  font-weight: 700;
  font-size: 12px;
  line-height: 20px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.palette.brandLight};

  &:disabled {
    color: #acacac;
  }
`;

const Status = styled.div`
  display: flex;
  align-items: center;
  gap: 8px; /* Space between icon and text */
`;

const StatusIcon = styled.div`
  display: flex;
  align-items: center;
`;

const StatusText = styled.div`
  display: flex;
  flex-direction: column;
`;

const Active = styled(active)``;

const Scheduled = styled(scheduled)``;

const Closed = styled(closed)``;
