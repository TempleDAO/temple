import styled from 'styled-components';
import { DashboardType } from '../DashboardContent';

type DashboardMetricsProps = {
  dashboardType: DashboardType;
};

const DashboardMetrics = ({ dashboardType }: DashboardMetricsProps) => {
  // TODO: Based on the dashboardType, we need to fetch and render the right data
  console.debug('DashboardMetrics with dashboardType: ', dashboardType);

  return (
    <>
      {' '}
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
    </>
  );
};

export default DashboardMetrics;

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
