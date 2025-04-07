import { subDays } from 'date-fns';
import LineChart from '../../components/LineChart';
import { formatNumberAbbreviated } from 'utils/formatter';
import { useTheme } from 'styled-components';
import { tickFormatter } from '../Chart';
import type { Metric } from '../Chart';
import Loader from 'components/Loader/Loader';

const pricesLast7Days: Metric[] = [
  {
    timestamp: subDays(new Date(), 6).getTime(),
    epoch1: 1.13,
    epoch2: 1.14,
    epoch3: 1.15,
  },
  {
    timestamp: subDays(new Date(), 5).getTime(),
    epoch1: 1.14,
    epoch2: 1.15,
    epoch3: 1.16,
  },
  {
    timestamp: subDays(new Date(), 4).getTime(),
    epoch1: 1.13,
    epoch2: 1.14,
    epoch3: 1.15,
  },
  {
    timestamp: subDays(new Date(), 3).getTime(),
    epoch1: 1.14,
    epoch2: 1.15,
    epoch3: 1.16,
  },
  {
    timestamp: subDays(new Date(), 2).getTime(),
    epoch1: 1.16,
    epoch2: 1.17,
    epoch3: 1.18,
  },
  {
    timestamp: subDays(new Date(), 1).getTime(),
    epoch1: 1.15,
    epoch2: 1.16,
    epoch3: 1.17,
  },
  { timestamp: new Date().getTime(), epoch1: 1.17, epoch2: 1.18, epoch3: 1.19 },
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
      lines={[
        { series: 'epoch1', color: theme.palette.brandLight },
        { series: 'epoch2', color: theme.palette.brandDark },
        { series: 'epoch3', color: '#D0BE75' },
      ]}
      xTickFormatter={tickFormatter}
      yTickFormatter={(val) =>
        `$${formatNumberAbbreviated(val).number.toFixed(2)}\u00A0M`
      }
      tooltipLabelFormatter={tickFormatter}
      tooltipValuesFormatter={(value) => [`$ ${value.toFixed(2)} M`, 'Value']}
      legendFormatter={(value) =>
        value === 'epoch1'
          ? 'EPOCH 1'
          : value === 'epoch2'
          ? 'EPOCH 2'
          : 'EPOCH 3'
      }
      yDomain={[1.1, 1.2]}
    />
  );
};

export default EmissionAllocationEpochChart;
