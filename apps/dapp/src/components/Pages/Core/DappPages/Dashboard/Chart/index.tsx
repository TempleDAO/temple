import styled from 'styled-components';
import { DashboardType } from '../DashboardContent';
import V2StrategyMetricsChart from './V2StrategyMetricsChart';
import { InputSelect } from 'components/InputSelect/InputSelect';
import { isV2SnapshotMetric, V2SnapshotMetric } from '../hooks/use-dashboardv2-daily-snapshots';
import { useState } from 'react';
import { ChartSupportedTimeInterval, DEFAULT_CHART_INTERVALS } from 'utils/time-intervals';
import { IntervalToggler } from 'components/Charts';
import { useSearchParams } from 'react-router-dom';

type DashboardChartProps = {
  dashboardType: DashboardType;
  strategyNames: string[];
};

const metricOptions: { value: V2SnapshotMetric; label: string }[] = [
  { label: 'Total Market Value', value: 'totalMarketValueUSD' },
  { label: 'Accrued Interest', value: 'accruedInterestUSD' },

  { label: 'Benchmark Performance', value: 'benchmarkPerformance' },
  { label: 'Benchmarked Equity', value: 'benchmarkedEquityUSD' },
  { label: 'Credit', value: 'creditUSD' },
  { label: 'Debt', value: 'debtUSD' },
  { label: 'Net Debt', value: 'netDebtUSD' },
  { label: 'Principal', value: 'principalUSD' },
  { label: 'Nominal Equity', value: 'nominalEquityUSD' },
  { label: 'Nominal Performance', value: 'nominalPerformance' },
];

const CHART_SELECTOR_QUERY_PARAM = 'chart';

const DashboardChart = ({ dashboardType, strategyNames }: DashboardChartProps) => {
  console.debug('DashboardChart with dashboardType: ', dashboardType);

  const [searchParams, setSearchParams] = useSearchParams();

  const defaultMetric: V2SnapshotMetric = 'totalMarketValueUSD';
  const chosenMetric = searchParams.get(CHART_SELECTOR_QUERY_PARAM);
  const selectedMetric: V2SnapshotMetric = isV2SnapshotMetric(chosenMetric) ? chosenMetric : defaultMetric;

  const [selectedInterval, setSelectedInterval] = useState<ChartSupportedTimeInterval>('1M');

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
              defaultValue={metricOptions.find((m) => m.value === selectedMetric)}
              onChange={(e) => selectMetric(e.value)}
              isSearchable={false}
            />
          </SelectMetricContainer>
          <IntervalTogglerContainer>
            <IntervalToggler selectedInterval={selectedInterval} setSelectedInterval={setSelectedInterval} />
          </IntervalTogglerContainer>
        </ChartHeader>
        <V2StrategyMetricsChart
          dashboardType={dashboardType}
          selectedMetric={selectedMetric}
          selectedInterval={selectedInterval}
          strategyNames={strategyNames}
        />
      </ChartContainer>
    </>
  );
};

export default DashboardChart;

const SelectMetricContainer = styled.div`
  min-width: 17rem;
  max-width: 20rem;
  flex: 1;
`;

const IntervalTogglerContainer = styled.div`
  margin-left: auto;
`;

const ChartHeader = styled.div`
  gap: 1rem;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  padding: 1rem;
  width: 100%;
`;

const ChartContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 1rem 0;
  width: 70vw;
`;
