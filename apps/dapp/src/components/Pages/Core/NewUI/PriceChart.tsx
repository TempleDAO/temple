import type { ChartSupportedTimeInterval } from 'utils/time-intervals';
import type { AxisDomain } from 'recharts/types/util/types';
import { useState } from 'react';
import styled, { useTheme } from 'styled-components';
import { format } from 'date-fns';
import { LineChart, IntervalToggler } from 'components/Charts';
import Loader from 'components/Loader/Loader';
import useRefreshableRamosMetrics, {
  RamosMetrics,
} from 'hooks/use-refreshable-ramos-metrics';
import { formatNumberFixedDecimals } from 'utils/formatter';
import { formatTimestampedChartData } from 'utils/charts';

type XAxisTickFormatter = (timestamp: number) => string;

const tickFormatters: Record<ChartSupportedTimeInterval, XAxisTickFormatter> = {
  '1D': (timestamp) => format(timestamp, 'h aaa'),
  '1W': (timestamp) => format(timestamp, 'eee d LLL'),
  '1M': (timestamp) => format(timestamp, 'MMM do'),
  '1Y': (timestamp) => format(timestamp, 'MMM do y'),
};

const tooltipLabelFormatters: Record<
  ChartSupportedTimeInterval,
  XAxisTickFormatter
> = {
  ...tickFormatters,
  '1D': (timestamp) => format(timestamp, 'MMM do, h aaa'),
};

const tooltipValueNames = {
  tpiUSD: 'Treasury price index (USD)',
  templePriceUSD: 'Temple price (USD)',
};

const tooltipValuesFormatter = (value: number, name: string) => [
  formatNumberFixedDecimals(value, 4).toString(),
  name,
];

const yDomain: AxisDomain = ([dataMin, dataMax]) => [
  dataMin - dataMin * 0.01,
  dataMax + dataMax * 0.01,
];

export const TemplePriceChart = () => {
  const [selectedInterval, setSelectedInterval] =
    useState<ChartSupportedTimeInterval>('1M');
  const { dailyMetrics, hourlyMetrics } = useRefreshableRamosMetrics();
  const theme = useTheme();

  if (dailyMetrics.length === 0 || hourlyMetrics.length === 0) {
    return <Loader iconSize={48} />;
  }

  const formattedData = formatTimestampedChartData(
    dailyMetrics,
    hourlyMetrics,
    formatData
  );

  return (
    <>
      <ChartHeader>
        <IntervalToggler
          selectedInterval={selectedInterval}
          setSelectedInterval={setSelectedInterval}
        />
      </ChartHeader>
      <LineChart
        chartData={formattedData[selectedInterval].reverse()}
        xDataKey="timestamp"
        lines={[
          { series: 'templePriceUSD', color: theme.palette.brand },
          { series: 'tpiUSD', color: theme.palette.light },
        ]}
        xTickFormatter={tickFormatters[selectedInterval]}
        tooltipLabelFormatter={tooltipLabelFormatters[selectedInterval]}
        yDomain={yDomain}
        legendFormatter={(name) =>
          name === 'tpiUSD'
            ? tooltipValueNames.tpiUSD
            : tooltipValueNames.templePriceUSD
        }
        tooltipValuesFormatter={(value, name) =>
          tooltipValuesFormatter(
            value,
            name === 'tpiUSD'
              ? tooltipValueNames.tpiUSD
              : tooltipValueNames.templePriceUSD
          )
        }
      />
    </>
  );
};

function formatData(metric: RamosMetrics) {
  return {
    timestamp: metric.timestamp * 1000,
    templePriceUSD: metric.templePriceUSD,
    tpiUSD: metric.treasuryPriceIndexUSD,
  };
}

const ChartHeader = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: 1.25rem;
  width: 90%;
`;
