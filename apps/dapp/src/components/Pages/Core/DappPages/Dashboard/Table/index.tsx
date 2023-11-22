import { useState } from 'react';
import { Button as BaseButton } from 'components/Button/Button';
import styled from 'styled-components';
import * as breakpoints from 'styles/breakpoints';
import TxnHistoryTable from './TxnHistoryTable';
import { DashboardType } from '../DashboardContent';

type DashboardTransactionHistoryProps = {
  dashboardType: DashboardType;
};

export enum TxHistoryFilterType {
  lastweek = 'lastweek',
  last30days = 'last30days',
  all = 'all',
  }

const DashboardTransactionHistory = ({ dashboardType }: DashboardTransactionHistoryProps) => {
  
  const [txFilter, setTxFilter] = useState<TxHistoryFilterType>(TxHistoryFilterType.all);

  return (
    <TransactionHistoryContainer>
      <TransactionHistoryHeader>
        <TransactionHistoryTitle>Transaction History</TransactionHistoryTitle>
        <TransactionTimePeriod>
          <FilterButton isSmall selected={txFilter === 'lastweek'} onClick={() => setTxFilter(TxHistoryFilterType.lastweek)}>
            Last week
          </FilterButton>
          <FilterButton isSmall selected={txFilter === 'last30days'} onClick={() => setTxFilter(TxHistoryFilterType.last30days)}>
            Last 30 Days
          </FilterButton>
          <FilterButton isSmall selected={txFilter === 'all'} onClick={() => setTxFilter(TxHistoryFilterType.all)}>
            All
          </FilterButton>
        </TransactionTimePeriod>
      </TransactionHistoryHeader>
      <TransactionHistoryContent>
        <TxnHistoryTable dashboardType={dashboardType} txFilter={txFilter} />
      </TransactionHistoryContent>
    </TransactionHistoryContainer>
  );
};

export default DashboardTransactionHistory;

type FilterButtonProps = {
  selected?: boolean;
};

const FilterButton = styled(BaseButton)<FilterButtonProps>`
  padding: 0;
  margin-right: 20px;
  height: 25px;
  border-radius: 5px;
  text-decoration: ${({ selected }) => (selected ? 'underline' : 'none')};
  color: ${({ selected, theme }) => (selected ? theme.palette.brandLight : theme.palette.brand)};
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
`;

const TransactionHistoryHeader = styled.div`
  display: flex;
  flex-direction: column;
  align-self: start;
  justify-content: space-between;
  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
    align-items: left;
    align-self: auto;
  `)}
`;

const TransactionTimePeriod = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 1rem;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const TransactionHistoryTitle = styled.div`
  font-size: 18px;
  ${breakpoints.tabletAndAbove(`
    font-size: 24px;
  `)}
  color: ${({ theme }) => theme.palette.brandLight};
`;

const TransactionHistoryContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 2rem;
  width: 100%
`;
