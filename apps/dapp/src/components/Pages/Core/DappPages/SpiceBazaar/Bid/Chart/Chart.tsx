import styled, { useTheme } from 'styled-components';
import { format } from 'date-fns';
import LineChart from './LineChart';
import Loader from 'components/Loader/Loader';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';
import { useAuctionsPriceHistory } from '../hooks/use-auctions-priceHistory';
import { DaiGoldAuctionInfo } from 'providers/SpiceBazaarProvider';
import { AxisDomain } from 'recharts/types/util/types';
import { formatNumberAbbreviated } from 'utils/formatter';

type XAxisTickFormatter = (timestamp: number) => string;

const tickFormatter: XAxisTickFormatter = (timestamp) => {
  return format(new Date(timestamp), 'MMM dd');
};

export const Chart = ({ auctionInfo }: { auctionInfo: DaiGoldAuctionInfo }) => {
  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });
  const theme = useTheme();

  const metrics = useAuctionsPriceHistory(isPhoneOrAbove, auctionInfo);

  if (!metrics.dailyMetrics.length) return <Loader />;

  const yDomain: AxisDomain = ([dataMin, dataMax]) => [
    0,
    dataMax + dataMax * 0.01,
  ];

  const yTickFormatter = (val: number) => {
    // if (val < 0.0001) return `${val.toFixed(6)} USDS`;
    const formattedValue = formatNumberAbbreviated(parseFloat(val.toFixed(2)));
    return `${formattedValue.string} USDS`;
  };

  return (
    <PageContainer>
      <LineChart
        chartData={metrics.dailyMetrics}
        xDataKey="timestamp"
        lines={[{ series: 'price', color: theme.palette.brandLight }]}
        xTickFormatter={tickFormatter}
        yTickFormatter={yTickFormatter}
        tooltipLabelFormatter={tickFormatter}
        yDomain={yDomain}
        tooltipValuesFormatter={(value) => {
          const formattedValue = formatNumberAbbreviated(
            parseFloat(value.toFixed(2))
          );
          return [`${formattedValue.string} USDS`];
        }}
      />
    </PageContainer>
  );
};

const PageContainer = styled.div`
  height: 100%;
`;
