import { Button as BaseButton } from 'components/Button/Button';
import { useState } from 'react';
import styled from 'styled-components';
import { TemplePriceChart } from './PriceChart';
import TxnHistoryTable from './TxnHistoryTable';

const TreasuryReservesVault = () => {
  const [filter, setFilter] = useState('all');

  return (
    <TreasuryReservesVaultContainer>
      <Header>
        <HeaderTitle>Treasury Reserves Vault</HeaderTitle>
        <HeaderText>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque vehicula tincidunt eleifend. Nam congue
          magna in mi dignissim, id gravida sem ornare. Sed in nunc fermentum, consectetur ipsum a, varius augue. Nullam
          finibus velit eget ligula efficitur, in luctus lacus efficitur. Nam egestas tempor gravida. Ut mollis libero
          ac tincidunt fermentum. Etiam et ante vitae metus ultrices tempus.
        </HeaderText>
      </Header>
      <BaseCurrencyContainer>
        <BaseCurrencyTitle>Base Currency</BaseCurrencyTitle>
        <BaseCurrencySelectorContainer>
          {/* // TODO: Pill shaped selector */}
          <CurrencyOption>USD</CurrencyOption>
          <CurrencyOption>DAI</CurrencyOption>
          <CurrencyOption>TEMPLE</CurrencyOption>
        </BaseCurrencySelectorContainer>
      </BaseCurrencyContainer>
      <ChartContainer>
        {/* // TODO: This price chart needs updated with the right data */}
        {/* // And also fixed to be the proper width */}
        <TemplePriceChart />
      </ChartContainer>
      <MetricsContainer>
        <MetricsRow>
          <Metric>
            <MetricValue>$1.68 B</MetricValue>
            <MetricTitle>Total Market Value</MetricTitle>
          </Metric>
          <Metric>
            <MetricValue>1.31 DAI</MetricValue>
            <MetricTitle>Spot Price</MetricTitle>
          </Metric>
          <Metric>
            <MetricValue>1.31 DAI</MetricValue>
            <MetricTitle>Treasury Price Index</MetricTitle>
          </Metric>
        </MetricsRow>
        <MetricsRow>
          <Metric>
            <MetricValue>$1.50 M</MetricValue>
            <MetricTitle>Circulating Supply</MetricTitle>
          </Metric>
          <Metric>
            <MetricValue>7% p.a.</MetricValue>
            <MetricTitle>Benchmark Rate</MetricTitle>
          </Metric>
        </MetricsRow>
      </MetricsContainer>
      <MetricsContainer>
        <MetricsRow>
          <Metric small>
            <MetricValue small>$1.24 B</MetricValue>
            <MetricTitle small>Principal</MetricTitle>
          </Metric>
          <Metric small>
            <MetricValue small>$980.33 K</MetricValue>
            <MetricTitle small>Accrued dUSD Interest</MetricTitle>
          </Metric>
          <Metric small>
            <MetricValue small>$0.44 B</MetricValue>
            <MetricTitle small>Accrued dUSD Interest</MetricTitle>
          </Metric>
          <Metric small>
            <MetricValue small>1.35%</MetricValue>
            <MetricTitle small>Nominal Performance</MetricTitle>
          </Metric>
        </MetricsRow>
        <MetricsRow>
          <Metric small>
            <MetricValue small>$1.20 B</MetricValue>
            <MetricTitle small>Benchmarked Equity</MetricTitle>
          </Metric>
          <Metric small>
            <MetricValue small>0.38%</MetricValue>
            <MetricTitle small>Benchmark Performance</MetricTitle>
          </Metric>
        </MetricsRow>
      </MetricsContainer>
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
          <TxnHistoryTable filter={filter} />
        </TransactionHistoryContent>
      </TransactionHistoryContainer>
    </TreasuryReservesVaultContainer>
  );
};

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

type MetricProps = {
  small?: boolean;
};

const MetricValue = styled.div<MetricProps>`
  font-size: ${({ small }) => (small ? '1rem' : '2rem')};
  color: ${({ theme }) => theme.palette.brandLight};
`;

const MetricTitle = styled.div<MetricProps>`
  font-size: ${({ small }) => (small ? '1rem' : '1.25rem')};
  color: ${({ theme }) => theme.palette.brand};
`;

const Metric = styled.div<MetricProps>`
  width: 250px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border: ${({ small, theme }) => (small ? 'none' : `1px solid ${theme.palette.brand}}`)};
  border-radius: 0.75rem;
  gap: 10px;
  padding: 1rem 0;
  background: ${({ theme }) => theme.palette.black};
`;

const MetricsContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
`;

const MetricsRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-evenly;
  gap: 4rem;
  margin: 2rem 0;
`;

const ChartContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 1rem 0;
  width: 70vw;
`;

const CurrencyOption = styled.div`
  display: flex;
  flex-direction: row;
  padding: 10px;
`;

const BaseCurrencySelectorContainer = styled.div`
  display: flex;
  width: 100%;
`;

const BaseCurrencyTitle = styled.div`
  color: ${(props) => props.theme.palette.brand};
  white-space: nowrap;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;

const BaseCurrencyContainer = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  margin: 20px;
`;

const HeaderText = styled.div`
  align-items: left;
`;

const HeaderTitle = styled.h2`
  font-size: 36px;
  color: ${(props) => props.theme.palette.brandLight};
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  align-items: left;
  width: 70vw;
`;

const TreasuryReservesVaultContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

export default TreasuryReservesVault;
