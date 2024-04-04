import { useState } from 'react';
import styled from 'styled-components';
import * as breakpoints from 'styles/breakpoints';
import TxnHistoryTable from './TxnHistoryTable';
import { DashboardData } from '../DashboardConfig';

type DashboardTransactionHistoryProps = {
  dashboardData: DashboardData;
};

export enum TxHistoryFilterType {
  lastweek = 'lastweek',
  last30days = 'last30days',
  all = 'all',
}

const DashboardTransactionHistory = ({
  dashboardData,
}: DashboardTransactionHistoryProps) => {
  const [txFilter, setTxFilter] = useState<TxHistoryFilterType>(
    TxHistoryFilterType.all
  );

  return (
    <TransactionHistoryContainer>
      <TransactionHistoryHeader>
        <TransactionHistoryTitle>Transaction History</TransactionHistoryTitle>
        <TransactionTimePeriod>
          <IntervalToggle
            selected={txFilter === 'lastweek'}
            onClick={() => setTxFilter(TxHistoryFilterType.lastweek)}
          >
            Last week
          </IntervalToggle>
          <IntervalToggle
            selected={txFilter === 'last30days'}
            onClick={() => setTxFilter(TxHistoryFilterType.last30days)}
          >
            Last 30 Days
          </IntervalToggle>
          <IntervalToggle
            selected={txFilter === 'all'}
            onClick={() => setTxFilter(TxHistoryFilterType.all)}
          >
            All
          </IntervalToggle>
        </TransactionTimePeriod>
      </TransactionHistoryHeader>
      <TransactionHistoryContent>
        <TxnHistoryTable dashboardData={dashboardData} txFilter={txFilter} />
      </TransactionHistoryContent>
    </TransactionHistoryContainer>
  );
};

export default DashboardTransactionHistory;

type IntervalToggleProps = {
  selected?: boolean;
};

const IntervalToggle = styled.label<IntervalToggleProps>`
  padding: 0;
  margin-right: 20px;
  height: 25px;
  border-radius: 5px;
  ${({ selected }) => selected && 'text-decoration: underline;'}
  ${({ selected }) => selected && 'font-weight: bold;'}
  color: ${({ selected, theme }) =>
    selected ? theme.palette.brandLight : theme.palette.brand};
  border: 0px;
  white-space: nowrap;
  &:last-child {
    margin-right: 0;
  }
`;

const TransactionHistoryContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  margin-top: 10px;
`;

const TransactionHistoryHeader = styled.div`
  display: flex;
  flex-direction: column;
  align-self: start;
  justify-content: space-between;
  gap: 30px;
  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
    align-items: center;
    align-self: auto;
  `)}
`;

const TransactionTimePeriod = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 1rem;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const TransactionHistoryTitle = styled.h4`
  margin: 0;
  margin-top: 20px;
  ${breakpoints.phone(`
    font-size: 18px;
  `)}
  color: ${({ theme }) => theme.palette.brandLight};
`;

const TransactionHistoryContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 2rem;
  width: 100%;
`;
