import { subDays } from 'date-fns';
import LineChart from './LineChart';
import { useTheme } from 'styled-components';
import { tickFormatter } from './Chart';
import type { Metric } from './Chart';
import Loader from 'components/Loader/Loader';

const pricesLast7Days: Metric[] = [
  { timestamp: subDays(new Date(), 6).getTime(), price: 1394823 },
  { timestamp: subDays(new Date(), 5).getTime(), price: 1494823 },
  { timestamp: subDays(new Date(), 4).getTime(), price: 1294823 },
  { timestamp: subDays(new Date(), 3).getTime(), price: 1554823 },
  { timestamp: subDays(new Date(), 2).getTime(), price: 1394823 },
  { timestamp: subDays(new Date(), 1).getTime(), price: 1494823 },
  { timestamp: new Date().getTime(), price: 1394823 },
];

const EmissionAllocationStaked = () => {
  const metrics = pricesLast7Days;
  const theme = useTheme();

  const formatWithCommas = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  if (!metrics.length) return <Loader />;
  return (
    <LineChart
      chartData={metrics.reverse()}
      xDataKey="timestamp"
      lines={[{ series: 'price', color: theme.palette.brandLight }]}
      xTickFormatter={tickFormatter}
      yTickFormatter={(val) => formatWithCommas(val)}
      tooltipLabelFormatter={tickFormatter}
      yDomain={[1290000, 1390000, 1490000, 1590000]}
      tooltipValuesFormatter={(value) => [value.toFixed(2)]}
    />
  );
};

export default EmissionAllocationStaked;
