import Loader from 'components/Loader/Loader';
import { useEffect, useMemo, useState, Fragment } from 'react';
import { useMediaQuery } from 'react-responsive';
import styled from 'styled-components';
import { queryPhone } from 'styles/breakpoints';
import { Nullable } from 'types/util';
import { DashboardType } from '../DashboardContent';
import useDashboardV2Metrics, { ArrangedDashboardMetrics } from '../hooks/use-dashboardv2-metrics';

type DashboardMetricsProps = {
  dashboardType: DashboardType;
};

const DashboardMetrics = ({ dashboardType }: DashboardMetricsProps) => {
  console.debug('DashboardMetrics with dashboardType: ', dashboardType);

  const [sourceData, setSourceData] = useState<Nullable<ArrangedDashboardMetrics>>(null);

  const {
    tlcMetrics,
    ramosMetrics,
    templeBaseMetrics,
    dsrBaseMetrics,
    treasuryReservesVaultMetrics,
    getArrangedStrategyMetrics,
    getArrangedTreasuryReservesVaultMetrics,
    isLoading,
  } = useDashboardV2Metrics();

  useEffect(() => {
    if (isLoading) {
      return setSourceData(null);
    }

    switch (dashboardType) {
      case DashboardType.TREASURY_RESERVES_VAULT:
        return setSourceData(getArrangedTreasuryReservesVaultMetrics(treasuryReservesVaultMetrics.data!));
      case DashboardType.TLC:
        return setSourceData(getArrangedStrategyMetrics(tlcMetrics.data!));
      case DashboardType.RAMOS:
        return setSourceData(getArrangedStrategyMetrics(ramosMetrics.data!));
      case DashboardType.TEMPLE_BASE:
        return setSourceData(getArrangedStrategyMetrics(templeBaseMetrics.data!));
      case DashboardType.DSR_BASE:
        return setSourceData(getArrangedStrategyMetrics(dsrBaseMetrics.data!));
    }
  }, [isLoading, dashboardType]);

  useEffect(() => {
    console.log(sourceData);
  }, [sourceData]);

  const isDesktop = useMediaQuery({
    query: queryPhone,
  });

  const mobileView = (sourceData: Nullable<ArrangedDashboardMetrics>) => (
    <>
      <MobileMetricsContainer>
        {sourceData!.metrics.map((row, idx) => (
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
        {sourceData!.smallMetrics.map((row, idx) => (
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

  const desktopView = (sourceData: Nullable<ArrangedDashboardMetrics>) => (
    <>
      <MetricsContainer>
        {sourceData!.metrics.map((row, idx) => (
          <MetricsRow key={idx}>
            {row.map((metric, idx) => (
              <Metric key={idx}>
                <MetricValue>{metric.value}</MetricValue>
                <MetricTitle>{metric.title}</MetricTitle>
              </Metric>
            ))}
          </MetricsRow>
        ))}
      </MetricsContainer>
      <MetricsContainer>
        {sourceData!.smallMetrics.map((row, idx) => (
          <MetricsRow key={idx}>
            {row.map((metric, idx) => (
              <Metric small key={idx}>
                <MetricValue small>{metric.value}</MetricValue>
                <MetricTitle small>{metric.title}</MetricTitle>
              </Metric>
            ))}
          </MetricsRow>
        ))}
      </MetricsContainer>
    </>
  );

  const viewForDevice = useMemo(() => {
    if (sourceData === null) return <Loader />;
    return isDesktop ? desktopView(sourceData) : mobileView(sourceData);
  }, [isDesktop, sourceData]);

  return sourceData === null || isLoading ? <Loader /> : viewForDevice;
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
