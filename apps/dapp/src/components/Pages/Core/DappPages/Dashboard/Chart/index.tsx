import styled from 'styled-components';
import { DashboardType } from '../DashboardContent';
import V2StrategyMetricsChart from './V2StrategyMetricsChart';
import { InputSelect } from 'components/InputSelect/InputSelect';
import { V2StrategyMetric } from 'hooks/use-coreV2-strategy-data';
import { useState } from 'react';
import { ChartSupportedTimeInterval, DEFAULT_CHART_INTERVALS } from 'utils/time-intervals';
import { IntervalToggler } from 'components/Charts';

type DashboardChartProps = {
  dashboardType: DashboardType;
  strategyNames: string[];
};

const metricOptions: { value: V2StrategyMetric, label: string }[] = [
    { label: 'Total Market Value', value: 'totalMarketValueUSD' },
    { label: 'Accrued Interest', value: 'accruedInterestUSD' },
    { label: 'Benchmark Performance', value: 'benchmarkPerformance' },
    { label: 'Benchmarked Equity', value: 'benchmarkedEquityUSD' },
    { label: 'Credit', value: 'creditUSD' },
    { label: 'Debt', value: 'debtUSD' },
    { label: 'Principal', value: 'principalUSD' },
    { label: 'Nominal Equity', value: 'nominalEquityUSD' },
    { label: 'Nominal Performance', value: 'nominalPerformance' },
]

const DashboardChart = ({ dashboardType, strategyNames }: DashboardChartProps) => {
  console.debug('DashboardChart with dashboardType: ', dashboardType);
  const [selectedMetric, setSelectedMetric] = useState<V2StrategyMetric>("totalMarketValueUSD")
  const [selectedInterval, setSelectedInterval] = useState<ChartSupportedTimeInterval>('1M');

  const intervals = DEFAULT_CHART_INTERVALS.filter(i=> ['1W', '1M', '1Y'].includes(i.label))

  return (
    <>
      <ChartContainer>
      <ChartHeader>
         <SelectMetricContainer>
            <InputSelect
              options={metricOptions}
              defaultValue={metricOptions[0]}
              onChange={(e) => setSelectedMetric(e.value)}
              isSearchable={false}
            />
          </SelectMetricContainer>
          <IntervalToggler
              selectedInterval={selectedInterval}
              setSelectedInterval={setSelectedInterval}
              intervals={intervals}
          />
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
  min-width: 20rem;
`

const ChartHeader = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 2rem;
    width: 100%;
`;

const ChartContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 1rem 0;
  width: 70vw;
`;
