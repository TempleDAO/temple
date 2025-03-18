import { subDays } from 'date-fns';
import LineChart from './LineChart';
import { formatNumberAbbreviated } from 'utils/formatter';
import { useTheme } from 'styled-components';
import { tickFormatter } from './Chart';
import type { Metric } from './Chart';
import Loader from 'components/Loader/Loader';

const pricesLast7Days: Metric[] = [
  { timestamp: subDays(new Date(), 6).getTime(), price: 22 },
  { timestamp: subDays(new Date(), 5).getTime(), price: 15 },
  { timestamp: subDays(new Date(), 4).getTime(), price: 25 },
  { timestamp: subDays(new Date(), 3).getTime(), price: 35 },
  { timestamp: subDays(new Date(), 2).getTime(), price: 50 },
  { timestamp: subDays(new Date(), 1).getTime(), price: 65 },
  { timestamp: new Date().getTime(), price: 75 },
];

const EmissionAllocationEpochChart = () => {
  const metrics = pricesLast7Days;
  const theme = useTheme();

  const formatWithPercent = (val: number) =>
    `${formatNumberAbbreviated(val).number}\u00A0%`;

  if (!metrics.length) return <Loader />;
  return (
    <LineChart
      chartData={metrics.reverse()}
      xDataKey="timestamp"
      lines={[{ series: 'price', color: theme.palette.brandLight }]}
      xTickFormatter={tickFormatter}
      yTickFormatter={formatWithPercent}
      tooltipLabelFormatter={tickFormatter}
      yDomain={[0, 25, 50, 75]}
      tooltipValuesFormatter={(value) => [formatWithPercent(value)]}
    />
  );
};

export default EmissionAllocationEpochChart;
