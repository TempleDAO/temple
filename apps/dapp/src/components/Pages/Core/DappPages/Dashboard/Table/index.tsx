import { useState } from 'react';
import { useMediaQuery } from 'react-responsive';
import { Button as BaseButton } from 'components/Button/Button';
import styled from 'styled-components';
import TxnHistoryTable from './TxnHistoryTable';
import { DashboardType } from '../DashboardContent';
import { dashboardTypeToStrategyKey } from '../hooks/use-dashboardv2-txHistory';
import { queryPhone } from 'styles/breakpoints';

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
  const selectedStrategy = dashboardTypeToStrategyKey(dashboardType);

  const isDesktop = useMediaQuery({
    query: queryPhone,
  });

  return (
    <TransactionHistoryContainer>
      <TransactionHistoryHeader isDesktop={isDesktop}>
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
        <TxnHistoryTable dashboardType={dashboardType} txFilter={txFilter} selectedStrategy={selectedStrategy}/>
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

const TransactionHistoryHeader = styled.div<{isDesktop: boolean}>`
  display: flex;
  flex-direction: ${({isDesktop}) => isDesktop ? 'row' : 'column'};
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