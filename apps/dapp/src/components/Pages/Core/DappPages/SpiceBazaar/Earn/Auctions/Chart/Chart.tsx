import { useEffect, useState } from 'react';
import styled, { useTheme } from 'styled-components';
import { format, subDays } from 'date-fns';
import LineChart from './LineChart';
import Loader from 'components/Loader/Loader';
import { formatNumberAbbreviated } from 'utils/formatter';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';

type XAxisTickFormatter = (timestamp: number) => string;

const tickFormatter: XAxisTickFormatter = (timestamp) =>
  format(new Date(timestamp), 'MMM dd');

type Metric = { timestamp: number; price: number };

const pricesLast7Days = [
  { timestamp: subDays(new Date(), 6).getTime(), price: 5.32 },
  { timestamp: subDays(new Date(), 5).getTime(), price: 5.3 },
  { timestamp: subDays(new Date(), 4).getTime(), price: 5.3 },
  { timestamp: subDays(new Date(), 3).getTime(), price: 5.36 },
  { timestamp: subDays(new Date(), 2).getTime(), price: 5.36 },
  { timestamp: subDays(new Date(), 1).getTime(), price: 5.34 },
  { timestamp: new Date().getTime(), price: 5.45 },
];

export const Chart = () => {
  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const theme = useTheme();

  useEffect(() => {
    isPhoneOrAbove
      ? setMetrics(pricesLast7Days)
      : setMetrics(pricesLast7Days.filter((_, index) => index % 2 === 0));
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
          `${formatNumberAbbreviated(val).number.toFixed(2)}\u00A0USDS`
        }
        tooltipLabelFormatter={tickFormatter}
        yDomain={[5.3, 5.45]}
        tooltipValuesFormatter={(value) => [
          `${value.toFixed(2)} USDS`,
          'Price',
        ]}
      />
    </PageContainer>
  );
};

const PageContainer = styled.div`
  height: 100%;
`;
