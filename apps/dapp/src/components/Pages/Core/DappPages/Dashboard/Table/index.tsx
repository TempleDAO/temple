import { useState } from 'react';
import { Button as BaseButton } from 'components/Button/Button';
import styled from 'styled-components';
import TxnHistoryTable from './TxnHistoryTable';
import { DashboardType } from '../DashboardContent';

type DashboardTransactionHistoryProps = {
  dashboardType: DashboardType;
};

export type TxHistoryFilterType = 'lastweek' | 'last30days' | 'all';

const DashboardTransactionHistory = ({ dashboardType }: DashboardTransactionHistoryProps) => {
  // TODO: Based on the dashboardType, we need to fetch and render the right data
  console.debug('DashboardTransactionHistory with dashboardType: ', dashboardType);

  const [filter, setFilter] = useState<TxHistoryFilterType>('all');

  return (
    <TransactionHistoryContainer>
      <TransactionHistoryHeader>
        <TransactionHistoryTitle>Transaction History</TransactionHistoryTitle>
        <TransactionTimePeriod>
          <FilterButton isSmall selected={filter === 'lastweek'} onClick={() => setFilter('lastweek')}>
            Last week
          </FilterButton>
          <FilterButton isSmall selected={filter === 'last30days'} onClick={() => setFilter('last30days')}>
            Last 30 Days
          </FilterButton>
          <FilterButton isSmall selected={filter === 'all'} onClick={() => setFilter('all')}>
            All
          </FilterButton>
        </TransactionTimePeriod>
      </TransactionHistoryHeader>
      <TransactionHistoryContent>
        <TxnHistoryTable dashboardType={dashboardType} filter={filter} />
      </TransactionHistoryContent>
    </TransactionHistoryContainer>
  );
};

export default DashboardTransactionHistory;

type FilterButtonProps = {
  selected?: boolean;
};

const FilterButton = styled(BaseButton)<FilterButtonProps>`
  margin: 0 5px;
  height: 25px;
  border-radius: 5px;
  text-decoration: ${({ selected }) => (selected ? 'underline' : 'none')};
  border: 0px;
  white-space: nowrap;
`;

const TransactionHistoryContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
`;

const TransactionHistoryHeader = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const TransactionTimePeriod = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 1rem;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const TransactionHistoryTitle = styled.div`
  font-size: 1.5rem;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const TransactionHistoryContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 70vw;
`;
