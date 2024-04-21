import Loader from 'components/Loader/Loader';
import { useMemo, Fragment } from 'react';
import { useMediaQuery } from 'react-responsive';
import styled from 'styled-components';
import * as breakpoints from 'styles/breakpoints';
import { queryPhone } from 'styles/breakpoints';
import { DashboardData } from '../DashboardConfig';
import useDashboardV2Metrics, {
  ArrangedDashboardMetrics,
} from '../hooks/use-dashboardv2-metrics';

type DashboardMetricsProps = {
  dashboardData: DashboardData;
};

const DashboardMetrics = ({ dashboardData }: DashboardMetricsProps) => {
  const { dashboardMetrics } = useDashboardV2Metrics(dashboardData);

  const isDesktop = useMediaQuery({
    query: queryPhone,
  });

  const mobileView = (sourceData: ArrangedDashboardMetrics) => (
    <>
      <MobileMetricsContainer>
        {sourceData.metrics.map((row, idx) => (
          <Fragment key={idx}>
            {row.map((metric, idx) => (
              <MobileMetricRow key={idx}>
                <MobileMetricTitle>{metric.title}</MobileMetricTitle>
                <MobileMetricValue>{metric.value}</MobileMetricValue>
              </MobileMetricRow>
            ))}
          </Fragment>
        ))}
      </MobileMetricsContainer>
      <MobileMetricsContainer small>
        {sourceData.smallMetrics.map((row, idx) => (
          // TODO: The MobileMetricsContainer for small should be .. smaller
          <Fragment key={idx}>
            {row.map((metric, idx) => (
              <MobileMetricRow key={idx}>
                <MobileMetricTitle>{metric.title}</MobileMetricTitle>
                <MobileMetricValue>{metric.value}</MobileMetricValue>
              </MobileMetricRow>
            ))}
          </Fragment>
        ))}
      </MobileMetricsContainer>
    </>
  );

  const desktopView = (sourceData: ArrangedDashboardMetrics) => (
    <MetricsContainer>
      <MetricsRow>
        {sourceData.metrics.map((row) =>
          row.map((metric) => (
            <Metric key={metric.title}>
              <MetricValue>{metric.value}</MetricValue>
              <MetricTitle>{metric.title}</MetricTitle>
            </Metric>
          ))
        )}
      </MetricsRow>
      <MetricsRow>
        {sourceData.smallMetrics.map((row) =>
          row.map((metric) => (
            <Metric small key={metric.title}>
              <MetricValue small>{metric.value}</MetricValue>
              <MetricTitle small>{metric.title}</MetricTitle>
            </Metric>
          ))
        )}
      </MetricsRow>
    </MetricsContainer>
  );

  const viewForDevice = useMemo(() => {
    if (!dashboardMetrics.data || dashboardMetrics.data === null)
      return <Loader />;
    return isDesktop
      ? desktopView(dashboardMetrics.data)
      : mobileView(dashboardMetrics.data);
  }, [isDesktop, dashboardMetrics.data]);

  return dashboardMetrics.data === null || dashboardMetrics.isLoading ? (
    <Loader />
  ) : (
    viewForDevice
  );
};

export default DashboardMetrics;

type MetricProps = {
  small?: boolean;
};

const MobileMetricValue = styled.div<MetricProps>`
  color: ${({ theme }) => theme.palette.brandLight};
`;

const MobileMetricTitle = styled.div<MetricProps>`
  color: ${({ theme }) => theme.palette.brand};
`;

const MobileMetricRow = styled.div`
  display: flex;
  justify-content: space-between;
  width: 100%;
`;

const MobileMetricsContainer = styled.div<MetricProps>`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding: ${({ small }) => (small ? 'none' : '10px')};
  gap: 10px;
  background: ${({ small, theme }) =>
    small
      ? theme.palette.black
      : `linear-gradient(180deg, #000000 0%, #1A1A1A 100%);`};
  border: ${({ small }) => (small ? 'none;' : `1px solid #bd7b4f;`)};
  border-radius: 10px;
`;

const MetricValue = styled.div<MetricProps>`
  font-size: ${({ small }) => (small ? '1.1rem;' : '1.8rem;')};
  color: ${({ theme }) => theme.palette.brandLight};
`;

const MetricTitle = styled.div<MetricProps>`
  font-size: ${({ small }) => (small ? '1rem;' : '1.1rem;')};
  color: ${({ theme }) => theme.palette.brand};
`;

const Metric = styled.div<MetricProps>`
  min-width: ${({ small }) => (small ? '130px;' : '180px;')}
  max-width: 25%;
  display: flex;
  flex: ${({ small }) => (small ? '20%;' : '30%;')}
  flex-direction: column;
  justify-content: center;
  text-align: center;
  text-wrap: nowrap;
  align-items: center;
  border: ${({ small, theme }) =>
    small ? 'none;' : `1px solid ${theme.palette.brand}};`};
  border-radius: 0.75rem;
  padding: 0.75rem 0;
  background: ${({ theme }) => theme.palette.black};
  margin: auto;
`;

const MetricsContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 2rem 0;
  gap: 2rem 0;
`;

const MetricsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 2rem 4rem;

  ${breakpoints.phoneToTablet(`
    gap: 1rem 2rem;
  }`)}
`;
