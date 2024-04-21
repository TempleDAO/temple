import styled from 'styled-components';
import * as breakpoints from 'styles/breakpoints';
import { DashboardData } from '../DashboardConfig';
import V2StrategyMetricsChart from './V2StrategyMetricsChart';
import { InputSelect } from 'components/InputSelect/InputSelect';
import {
  isV2SnapshotMetric,
  V2SnapshotMetric,
} from '../hooks/use-dashboardv2-daily-snapshots';
import { useState } from 'react';
import { ChartSupportedTimeInterval } from 'utils/time-intervals';
import { IntervalToggler } from 'components/Charts';
import { useSearchParams } from 'react-router-dom';
import { useMediaQuery } from 'react-responsive';

type DashboardChartProps = {
  dashboardData: DashboardData;
};

const metricOptions: { value: V2SnapshotMetric; label: string }[] = [
  { label: 'Total Market Value', value: 'totalMarketValueUSD' },
  { label: 'Accrued Interest', value: 'accruedInterestUSD' },

  { label: 'Benchmarked Equity', value: 'benchmarkedEquityUSD' },
  { label: 'Credit', value: 'creditUSD' },
  { label: 'Debt', value: 'debtUSD' },
  { label: 'Net Debt', value: 'netDebtUSD' },
  { label: 'Principal', value: 'principalUSD' },
];

const CHART_SELECTOR_QUERY_PARAM = 'chart';

const DashboardChart = ({ dashboardData }: DashboardChartProps) => {
  console.debug('DashboardChart with name: ', dashboardData.name);

  const [searchParams, setSearchParams] = useSearchParams();
  const isDesktop = useMediaQuery({
    query: breakpoints.queryPhone,
  });

  const defaultMetric: V2SnapshotMetric = 'totalMarketValueUSD';
  const chosenMetric = searchParams.get(CHART_SELECTOR_QUERY_PARAM);
  const selectedMetric: V2SnapshotMetric = isV2SnapshotMetric(chosenMetric)
    ? chosenMetric
    : defaultMetric;

  const [selectedInterval, setSelectedInterval] =
    useState<ChartSupportedTimeInterval>('1M');

  const selectMetric = (value: string) => {
    if (isV2SnapshotMetric(value)) {
      setSearchParams({ ...searchParams, [CHART_SELECTOR_QUERY_PARAM]: value });
    }
  };

  return (
    <>
      <ChartContainer>
        <ChartHeader>
          <SelectMetricContainer>
            <InputSelect
              options={metricOptions}
              defaultValue={metricOptions.find(
                (m) => m.value === selectedMetric
              )}
              onChange={(e) => selectMetric(e.value)}
              isSearchable={false}
              fontSize={isDesktop ? '16px' : '12px'}
            />
          </SelectMetricContainer>
          <IntervalTogglerContainer>
            <IntervalToggler
              selectedInterval={selectedInterval}
              setSelectedInterval={setSelectedInterval}
            />
          </IntervalTogglerContainer>
        </ChartHeader>
        <V2StrategyMetricsChart
          dashboardData={dashboardData}
          selectedMetric={selectedMetric}
          selectedInterval={selectedInterval}
        />
      </ChartContainer>
    </>
  );
};

export default DashboardChart;

const SelectMetricContainer = styled.div`
  width: 100%;
  flex: 1;
  ${breakpoints.phoneAndAbove(`
    max-width: 20rem;
  `)}
`;

const IntervalTogglerContainer = styled.div`
  margin-left: auto;
`;

const ChartHeader = styled.div`
  gap: 1rem;
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  align-items: center;
  width: 100%;
  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
  `)}
`;

const ChartContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
`;
