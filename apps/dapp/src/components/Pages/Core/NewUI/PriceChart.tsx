import type { ChartSupportedTimeInterval } from 'utils/time-intervals';
import type { PriceMetricsRamos } from 'hooks/use-refreshable-price-metrics-ramos';

import { useState } from 'react';
import { useTheme } from 'styled-components';
import { format } from 'date-fns';
import { LineChart, IntervalToggler } from 'components/Charts';
import useRefreshablePriceMetricsRamos from 'hooks/use-refreshable-price-metrics-ramos';
import { formatTimestampedChartData } from 'utils/charts';

//const xTickFormatter = (value: number) =>

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
      {/*<LineChart
        chartData={formattedData[selectedInterval]}
        xDataKey="timestamp"
        lines={[
          { series: 'templePriceUSD', color: theme.palette.brand },
          { series: 'tpiUSD', color: theme.palette.light },
        ]}
    />*/}
    </>
  );
};

function formatData(metric: PriceMetricsRamos) {
  return {
    timestamp: metric.timestamp,
    templePriceUSD: metric.templePriceUSD,
    tpiUSD: metric.treasuryPriceIndexUSD,
  };
}
