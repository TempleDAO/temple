import type { ChartSupportedTimeInterval } from 'utils/time-intervals';
import type { PriceMetricsRamos } from 'hooks/use-refreshable-price-metrics-ramos';
import type { AxisDomain } from 'recharts/types/util/types';

import { useState } from 'react';
import { useTheme } from 'styled-components';
import { format } from 'date-fns';
import { LineChart, IntervalToggler } from 'components/Charts';
import Loader from 'components/Loader/Loader';
import useRefreshablePriceMetricsRamos from 'hooks/use-refreshable-price-metrics-ramos';
import { formatNumberFixedDecimals } from 'utils/formatter';
import { formatTimestampedChartData } from 'utils/charts';

type XAxisTickFormatter = (timestamp: number) => string;

const tickFormatters: Record<ChartSupportedTimeInterval, XAxisTickFormatter> = {
  '1D': (timestamp) => format(timestamp, 'h aaa'),
  '1W': (timestamp) => format(timestamp, 'eee d LLL'),
  '1M': (timestamp) => format(timestamp, 'MMM do'),
  '1Y': (timestamp) => format(timestamp, 'MMM do y'),
};

const tooltipLabelFormatters: Record<ChartSupportedTimeInterval, XAxisTickFormatter> = {
  ...tickFormatters,
  '1D': (timestamp) => format(timestamp, 'MMM do, h aaa'),
};

const tooltipValueNames = {
  tpiUSD: 'Treasury price index (USD)',
  templePriceUSD: 'Temple price (USD)',
};

const tooltipValuesFormatter = (value: number, name: string) => [formatNumberFixedDecimals(value, 4).toString(), name];

const yDomain: AxisDomain = ([dataMin, dataMax]) => [dataMin - dataMin * 0.01, dataMax + dataMax * 0.01];

export const TemplePriceChart = () => {
  const [selectedInterval, setSelectedInterval] = useState<ChartSupportedTimeInterval>('1M');
  const { dailyPriceMetrics, hourlyPriceMetrics } = useRefreshablePriceMetricsRamos();

  const theme = useTheme();

  if (dailyPriceMetrics.length === 0 || hourlyPriceMetrics.length === 0) {
    return <Loader iconSize={48} />;
  }

  const filteredHourlyMetrics = hourlyPriceMetrics.reverse().slice(0, 24);

  const formattedData = formatTimestampedChartData(dailyPriceMetrics, filteredHourlyMetrics, formatData);

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
          tooltipLabelFormatter={tooltipLabelFormatters[selectedInterval]}
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
