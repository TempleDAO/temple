import styled from 'styled-components';
import { DashboardType } from '../DashboardContent';

type DashboardMetricsProps = {
  dashboardType: DashboardType;
};

const DashboardMetrics = ({ dashboardType }: DashboardMetricsProps) => {
  // TODO: Based on the dashboardType, we need to fetch and render the right data
  console.debug('DashboardMetrics with dashboardType: ', dashboardType);

  const treasuryReservesVaultMetricsData = {
    // one array per row
    metrics: [
      [
        {
          title: 'Total Market Value',
          value: '$1.68 B',
        },
        {
          title: 'Spot Price',
          value: '1.31 DAI',
        },
        {
          title: 'Treasury Price Index',
          value: '1.31 DAI',
        },
      ],
      [
        {
          title: 'Circulating Supply',
          value: '$1.50 M',
        },
        {
          title: 'Benchmark Rate',
          value: '7% p.a.',
        },
      ],
    ],
    // these are the "small" metrics that appear below the metrics
    // again, one array per row
    smallMetrics: [
      [
        {
          title: 'Principal',
          value: '$1.24 B',
        },
        {
          title: 'Accrued dUSD Interest',
          value: '$980.33 K',
        },
        {
          title: 'Accrued dUSD Interest',
          value: '$0.44 B',
        },
        {
          title: 'Nominal Performance',
          value: '1.35%',
        },
      ],
      [
        {
          title: 'Benchmarked Equity',
          value: '$1.20 B',
        },
        {
          title: 'Benchmark Performance',
          value: '0.38%',
        },
      ],
    ],
  };

  return (
    <>
      {' '}
      <MetricsContainer>
        {treasuryReservesVaultMetricsData.metrics.map((row) => (
          <MetricsRow>
            {row.map((metric) => (
              <Metric>
                <MetricValue>{metric.value}</MetricValue>
                <MetricTitle>{metric.title}</MetricTitle>
              </Metric>
            ))}
          </MetricsRow>
        ))}
      </MetricsContainer>
      <MetricsContainer>
        {treasuryReservesVaultMetricsData.smallMetrics.map((row) => (
          <MetricsRow>
            {row.map((metric) => (
              <Metric small>
                <MetricValue small>{metric.value}</MetricValue>
                <MetricTitle small>{metric.title}</MetricTitle>
              </Metric>
            ))}
          </MetricsRow>
        ))}
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
