import { useEffect, useState } from 'react';
import styled, { useTheme } from 'styled-components';
import { subHours } from 'date-fns';
import LineChart from './LineChart';
import Loader from 'components/Loader/Loader';
import { formatNumberAbbreviated } from 'utils/formatter';

const tickFormatter = (timestamp: number) => {
  const hoursAgo = Math.floor(
    (new Date().getTime() - timestamp) / (1000 * 60 * 60)
  );
  return `${hoursAgo}h`;
};

type Metric = { timestamp: number; price: number };

const pricesLast72H = [
  { timestamp: new Date().getTime(), price: 1.8 },
  { timestamp: subHours(new Date(), 12).getTime(), price: 2.1 },
  { timestamp: subHours(new Date(), 24).getTime(), price: 2.4 },
  { timestamp: subHours(new Date(), 36).getTime(), price: 2.6 },
  { timestamp: subHours(new Date(), 48).getTime(), price: 2.2 },
  { timestamp: subHours(new Date(), 60).getTime(), price: 3.7 },
  { timestamp: subHours(new Date(), 72).getTime(), price: 3.2 },
];

export const Chart = () => {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const theme = useTheme();

  useEffect(() => {
    setMetrics(pricesLast72H);
  }, []);

  if (!metrics.length) return <Loader />;

  return (
    <PageContainer>
      <LineChart
        chartData={metrics.reverse()}
        xDataKey="timestamp"
        lines={[{ series: 'price', color: theme.palette.brandLight }]}
        xTickFormatter={tickFormatter}
        yTickFormatter={(val) =>
          `${formatNumberAbbreviated(val).number.toFixed(2)} TGLD`
        }
        tooltipLabelFormatter={tickFormatter}
        yDomain={[1, 4]}
        tooltipValuesFormatter={(value) => [
          `${value.toFixed(2)} TGLD`,
          'Price',
        ]}
      />
    </PageContainer>
  );
};

const PageContainer = styled.div`
  height: 100%;
`;
