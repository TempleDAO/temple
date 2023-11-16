import Loader from 'components/Loader/Loader';
import { useMemo, Fragment } from 'react';
import { useMediaQuery } from 'react-responsive';
import styled from 'styled-components';
import * as breakpoints from 'styles/breakpoints';
import { queryPhone } from 'styles/breakpoints';
import { DashboardType } from '../DashboardContent';
import useDashboardV2Metrics, { ArrangedDashboardMetrics } from '../hooks/use-dashboardv2-metrics';

type DashboardMetricsProps = {
  dashboardType: DashboardType;
};

const DashboardMetrics = ({ dashboardType }: DashboardMetricsProps) => {
  const { dashboardMetrics } = useDashboardV2Metrics(dashboardType);

  const isDesktop = useMediaQuery({
    query: queryPhone,
  });

  const mobileView = (sourceData: ArrangedDashboardMetrics) => (
    <MobileContainer>
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
    </MobileContainer>
  );

  const desktopView = (sourceData: ArrangedDashboardMetrics) => (
    <>
      <MetricsContainer>
        <MetricsRow>
          {sourceData.metrics.map((row) =>
            row.map((metric, idx) => (
              <Metric key={idx}>
                <MetricValue>{metric.value}</MetricValue>
                <MetricTitle>{metric.title}</MetricTitle>
              </Metric>
            ))
          )}
        </MetricsRow>
        <MetricsRow>
          {sourceData.smallMetrics.map((row) =>
            row.map((metric, idx) => (
              <Metric small key={idx}>
                <MetricValue small>{metric.value}</MetricValue>
                <MetricTitle small>{metric.title}</MetricTitle>
              </Metric>
            ))
          )}
        </MetricsRow>
      </MetricsContainer>
    </>
  );

  const viewForDevice = useMemo(() => {
    if (!dashboardMetrics.data || dashboardMetrics.data === null) return <Loader />;
    return isDesktop ? desktopView(dashboardMetrics.data) : mobileView(dashboardMetrics.data);
  }, [isDesktop, dashboardMetrics.data]);

  return dashboardMetrics.data === null || dashboardMetrics.isLoading ? <Loader /> : viewForDevice;
};

export default DashboardMetrics;

type MetricProps = {
  small?: boolean;
};

const MobileMetricValue = styled.div<MetricProps>`
  font-size: ${({ small }) => (small ? '10px' : '12px')};
  color: ${({ theme }) => theme.palette.brandLight};
`;

const MobileMetricTitle = styled.div<MetricProps>`
  font-size: ${({ small }) => (small ? '10px' : '12px')};
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
  padding: 10px;
  gap: 10px;
  background: ${({ small, theme }) =>
    small ? theme.palette.black : `linear-gradient(180deg, #000000 0%, #1A1A1A 100%)`};
  border: ${({ small }) => (small ? 'none' : `1px solid #bd7b4f`)};
  border-radius: 10px;
`;

const MetricValue = styled.div<MetricProps>`
  font-size: ${({ small }) => (small ? '1.1rem' : '1.8rem')};
  color: ${({ theme }) => theme.palette.brandLight};
`;

const MetricTitle = styled.div<MetricProps>`
  font-size: ${({ small }) => (small ? '1rem' : '1.1rem')};
  color: ${({ theme }) => theme.palette.brand};
`;

const Metric = styled.div<MetricProps>`
  min-width: ${({small}) => (small ? '120px': '180px;')}
  max-width: 30%;
  display: flex;
  flex: 10%;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border: ${({ small, theme }) => (small ? 'none' : `1px solid ${theme.palette.brand}}`)};
  border-radius: 0.75rem;
  padding: 0.75rem 0;
  background: ${({ theme }) => theme.palette.black};

  ${breakpoints.smallTabletToTablet(`
    flex: 20%;
  }`)}

  ${breakpoints.phoneToSmallTablet(`
    flex: 30%;
  }`)}
`;

const MobileContainer = styled.div`
  width: 45%;
  margin: 2rem 0;
`;

const MetricsContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  margin: 2rem 0;
  gap: 2rem 0;

  ${breakpoints.tabletToDesktop(`
    width: 80%;
  }`)}

  ${breakpoints.phoneToTablet(`
    width: 70%;
  }`)}
`;

const MetricsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-evenly;
  gap: 2rem 4rem;

  ${breakpoints.phoneToTablet(`
    gap: 1rem 3rem;
  }`)}
`;
