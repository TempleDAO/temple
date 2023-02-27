import type { ChartSupportedTimeInterval } from 'utils/time-intervals';
import type { PriceMetricsRamos } from 'hooks/use-refreshable-price-metrics-ramos';
import type { AxisDomain } from 'recharts/types/util/types';

import { useState } from 'react';
import { useTheme } from 'styled-components';
import { format } from 'date-fns';
import { LineChart, IntervalToggler } from 'components/Charts';
import useRefreshablePriceMetricsRamos from 'hooks/use-refreshable-price-metrics-ramos';
import { formatNumberWithCommas } from 'utils/formatter';
import { formatTimestampedChartData } from 'utils/charts';

type XAxisTickFormatter = (timestamp: number) => string;

const tickFormatters: Record<ChartSupportedTimeInterval, XAxisTickFormatter> = {
  '1D': (timestamp) => format(timestamp, 'H aaa'),
  '1W': (timestamp) => format(timestamp, 'eee d LLL'),
  '1M': (timestamp) => format(timestamp, 'MMM do'),
  '1Y': (timestamp) => format(timestamp, 'MMM do y'),
};

const tooltipValueNames = {
  tpiUSD: 'Treasury price index (USD)',
  templePriceUSD: 'Temple price (USD)',
};

const tooltipValuesFormatter = (value: number, name: string) => [formatNumberWithCommas(value), name];

const yDomain: AxisDomain = ([dataMin, dataMax]) => [dataMin - dataMin * 0.1, dataMax + dataMax * 0.1];

export const TemplePriceChart = () => {
  const [selectedInterval, setSelectedInterval] = useState<ChartSupportedTimeInterval>('1M');
  const { dailyPriceMetrics, hourlyPriceMetrics } = useRefreshablePriceMetricsRamos();

  const theme = useTheme();

  if (dailyPriceMetrics.length === 0 || hourlyPriceMetrics.length === 0) {
    return <div>Loading...</div>;
  }

  const formattedData = formatTimestampedChartData(dailyPriceMetrics, hourlyPriceMetrics, formatData);

  return (
    <>
      <IntervalToggler selectedInterval={selectedInterval} setSelectedInterval={setSelectedInterval} />
      {
        <LineChart
          chartData={formattedData[selectedInterval].reverse()}
          xDataKey="timestamp"
          lines={[
            { series: 'templePriceUSD', color: theme.palette.brand },
            { series: 'tpiUSD', color: theme.palette.light },
          ]}
          xTickFormatter={tickFormatters[selectedInterval]}
          tooltipLabelFormatter={tickFormatters[selectedInterval]}
          yDomain={yDomain}
          legendFormatter={(name) => (name === 'tpiUSD' ? tooltipValueNames.tpiUSD : tooltipValueNames.templePriceUSD)}
          tooltipValuesFormatter={(value, name) =>
            tooltipValuesFormatter(
              value,
              name === 'tpiUSD' ? tooltipValueNames.tpiUSD : tooltipValueNames.templePriceUSD
            )
          }
        />
      }
    </>
  );
};

function formatData(metric: PriceMetricsRamos) {
  return {
    timestamp: metric.timestamp * 1000,
    templePriceUSD: metric.templePriceUSD,
    tpiUSD: metric.treasuryPriceIndexUSD,
  };
}
