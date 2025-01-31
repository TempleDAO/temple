import { subDays } from 'date-fns';
import LineChart from './LineChart';
import { formatNumberAbbreviated } from 'utils/formatter';
import { useTheme } from 'styled-components';
import { tickFormatter } from './Chart';
import type { Metric } from './Chart';
import Loader from 'components/Loader/Loader';

const pricesLast7Days: Metric[] = [
  { timestamp: subDays(new Date(), 6).getTime(), price: 1.13 },
  { timestamp: subDays(new Date(), 5).getTime(), price: 1.14 },
  { timestamp: subDays(new Date(), 4).getTime(), price: 1.13 },
  { timestamp: subDays(new Date(), 3).getTime(), price: 1.14 },
  { timestamp: subDays(new Date(), 2).getTime(), price: 1.16 },
  { timestamp: subDays(new Date(), 1).getTime(), price: 1.15 },
  { timestamp: new Date().getTime(), price: 1.17 },
];

const TotalBidsChart = () => {
  const metrics = pricesLast7Days;
  const theme = useTheme();

  if (!metrics.length) return <Loader />;
  return (
    <LineChart
      chartData={metrics.reverse()}
      xDataKey="timestamp"
      lines={[{ series: 'price', color: theme.palette.brandLight }]}
      xTickFormatter={tickFormatter}
      yTickFormatter={(val) =>
        `$${formatNumberAbbreviated(val).number.toFixed(2)}\u00A0M`
      }
      tooltipLabelFormatter={tickFormatter}
      yDomain={[1.12, 1.14, 1.16, 1.18]}
      tooltipValuesFormatter={(value) => [`$ ${value.toFixed(2)} M`, 'Value']}
    />
  );
};

export default TotalBidsChart;
