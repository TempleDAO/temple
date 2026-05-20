import { useEffect, useMemo } from 'react';
import styled, { useTheme } from 'styled-components';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  ResponsiveContainer,
} from 'recharts';
import Loader from 'components/Loader/Loader';
import { formatNumberAbbreviated } from 'utils/formatter';
import { Option } from '../../components/InputSelector';
import { useAuctionOverview } from '../hooks/use-auction-overview';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';

const TGLD_COLOR = '#4E87A0';
const OFFERED_COLOR = '#BD7B4F';

const numberFormatter = new Intl.NumberFormat('en-US');

type AuctionOverviewChartProps = {
  auctionAddress: string;
  selectedFilters: Option[];
  onFilterOptionsChange?: (options: Option[]) => void;
};

export const AuctionOverviewChart = ({
  auctionAddress,
  selectedFilters,
  onFilterOptionsChange,
}: AuctionOverviewChartProps) => {
  const theme = useTheme();
  const isPhoneOrAbove = useMediaQuery({ query: queryPhone });
  const { data: metrics, loading, error } = useAuctionOverview(auctionAddress);

  const epochOptions: Option[] = useMemo(
    () =>
      (metrics ?? []).map((m) => ({
        label: `Epoch ${m.epoch} - ${m.date}`,
        value: m.epoch,
      })),
    [metrics]
  );

  useEffect(() => {
    if (onFilterOptionsChange) {
      onFilterOptionsChange(epochOptions);
    }
  }, [epochOptions, onFilterOptionsChange]);

  if (loading)
    return (
      <StateContainer>
        <Loader />
      </StateContainer>
    );

  if (error) return <StateContainer>{error}</StateContainer>;

  if (!metrics || metrics.length === 0)
    return <StateContainer>No chart data available</StateContainer>;

  const activeFilters =
    selectedFilters.length > 0 ? selectedFilters : epochOptions;

  const chartData = metrics.filter((m) =>
    activeFilters.some((f) => f.value === m.epoch)
  );

  const allValues = chartData.flatMap((d) => [
    d.totalBidAmount,
    d.totalOfferedAmount,
  ]);
  const maxValue = Math.max(...allValues, 0);

  return (
    <ChartContainer>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart
          data={chartData}
          margin={{
            left: isPhoneOrAbove ? 12 : 5,
            top: 20,
            right: isPhoneOrAbove ? 30 : 5,
            bottom: 0,
          }}
          barCategoryGap="20%"
          barGap={4}
        >
          <CartesianGrid
            horizontal
            vertical={false}
            stroke={theme.palette.brandDarker}
          />
          <XAxis
            dataKey="epoch"
            axisLine={false}
            tickLine={false}
            tick={{
              fill: theme.palette.brandLight,
              fontFamily: 'Caviar Dreams',
              fontSize: 12,
              fontWeight: 400,
            }}
            tickMargin={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            domain={[0, Math.ceil(maxValue * 1.2)]}
            tickFormatter={(val) => formatNumberAbbreviated(val).string}
            tick={{
              fill: theme.palette.brandLight,
              fontFamily: 'Caviar Dreams',
              fontSize: 12,
              fontWeight: 400,
            }}
            tickMargin={16}
            width={isPhoneOrAbove ? 70 : 55}
          />
          <Tooltip
            cursor={false}
            wrapperStyle={{ outline: 'none' }}
            contentStyle={{
              background:
                'linear-gradient(180deg, #353535 45.25%, #101010 87.55%)',
              boxShadow: '3px 6px 5.5px 0px #00000080',
              color: theme.palette.brand,
              borderRadius: '15px',
              border: 0,
              padding: '12px 16px',
            }}
            itemStyle={{
              background: 'transparent',
              color: theme.palette.brandLight,
              fontSize: '12px',
            }}
            labelStyle={{
              background: 'transparent',
              color: theme.palette.brand,
              fontSize: '14px',
              fontWeight: 'bold',
            }}
            formatter={(value: number, name: string) => [
              numberFormatter.format(value),
              name === 'Total Token Bid (TGLD)' ? 'TGLD Bid' : 'Tokens Offered',
            ]}
          />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{
              fontFamily: 'Caviar Dreams',
              fontSize: '12px',
              color: theme.palette.brandLight,
              paddingBottom: '10px',
            }}
          />
          <Bar
            dataKey="totalBidAmount"
            name="Total Token Bid (TGLD)"
            fill={TGLD_COLOR}
            radius={[5, 5, 0, 0]}
            activeBar={false}
          >
            <LabelList
              dataKey="totalBidAmount"
              position="top"
              formatter={(val: number) => numberFormatter.format(val)}
              style={{
                fontFamily: 'Caviar Dreams',
                fontSize: isPhoneOrAbove ? '11px' : '9px',
                fill: theme.palette.brandLight,
              }}
            />
          </Bar>
          <Bar
            dataKey="totalOfferedAmount"
            name="Total Tokens Offered"
            fill={OFFERED_COLOR}
            radius={[5, 5, 0, 0]}
            activeBar={false}
          >
            <LabelList
              dataKey="totalOfferedAmount"
              position="top"
              formatter={(val: number) => numberFormatter.format(val)}
              style={{
                fontFamily: 'Caviar Dreams',
                fontSize: isPhoneOrAbove ? '11px' : '9px',
                fill: theme.palette.brandLight,
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

const ChartContainer = styled.div`
  width: 100%;
`;

const StateContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 350px;
  color: ${({ theme }) => theme.palette.brand};
  font-size: 16px;
`;
