import styled from 'styled-components';
import { format } from 'date-fns';
import { useCallback, useMemo } from 'react';
import { formatNumberAbbreviated } from 'utils/formatter';
import CustomBarChart from './BarChart';
import { useAdminVestingChart } from '../hooks/use-admin-vesting-chart';
import Loader from 'components/Loader/Loader';
import { getYAxisDomainAndTicks } from 'components/Pages/Core/DappPages/SpiceBazaar/components/GetYAxisDomainAndTicks';

const LOADER_ICON_SIZE = 48;
const MIN_CHART_HEIGHT = 300;
const ERROR_PADDING = 40;
const USER_COLORS = ['#FFDEC9', '#D0BE75', '#BD7B4F', '#95613F'];

interface UserSeries {
  key: string;
}

// ---- Pure helpers (no side-effects) ----
const tickFormatter = (timestamp: number): string =>
  format(new Date(timestamp), 'MMM');

function calculateMonthTotal(data: Metric, userSeries: UserSeries[]): number {
  return userSeries.reduce((sum, user) => {
    return sum + (data[user.key] || 0);
  }, 0);
}

function findHoveredUser(
  data: Metric,
  userSeries: UserSeries[]
): { user: UserSeries; value: number } {
  let hoveredUser = userSeries[0];
  let hoveredValue = 0;

  userSeries.forEach((user) => {
    const value = data[user.key] || 0;
    if (value > hoveredValue) {
      hoveredValue = value;
      hoveredUser = user;
    }
  });

  return { user: hoveredUser, value: hoveredValue };
}

function calculatePercentage(value: number, total: number): string {
  return total > 0 ? ((value / total) * 100).toFixed(0) : '0';
}

function createTooltipContent(
  data: Metric,
  userSeries: UserSeries[]
): string[] {
  const dateLabel = tickFormatter(data.timestamp);

  // Safety check: if no user series, return simple message
  if (userSeries.length === 0) {
    return [`No vesting data for ${dateLabel}`];
  }

  const monthTotal = calculateMonthTotal(data, userSeries);
  const { value: hoveredValue } = findHoveredUser(data, userSeries);
  const percent = calculatePercentage(hoveredValue, monthTotal);

  return [
    `Amount to be vested: ${hoveredValue.toLocaleString()} TGLD`,
    `Percentage of total amount to be vested in ${dateLabel}:`,
    `${hoveredValue.toLocaleString()} / ${monthTotal.toLocaleString()} = ${percent}%`,
  ];
}

function calculateChartValues(
  chartData: Metric[],
  userSeries: UserSeries[]
): number[] {
  if (userSeries.length === 0) return [0];

  return chartData.map((dataPoint) => {
    return userSeries.reduce((sum, user) => {
      return sum + (dataPoint[user.key] || 0);
    }, 0);
  });
}

export type Metric = {
  timestamp: number;
  total?: number; // Total line above bars
  [key: string]: number | undefined; // Dynamic keys for users
};

const ChartContainer = ({ children }: { children: React.ReactNode }) => (
  <PageContainer>
    <HeaderContainer>
      <Title>Projected TGLD Vesting By Month</Title>
      <Legend>
        <DashedLine />
        <LegendText>TGLD balance runway</LegendText>
      </Legend>
    </HeaderContainer>
    {children}
  </PageContainer>
);

const LoadingState = () => (
  <ChartContainer>
    <LoaderContainer>
      <Loader iconSize={LOADER_ICON_SIZE} />
    </LoaderContainer>
  </ChartContainer>
);

const EmptyState = () => (
  <ChartContainer>No vesting data available</ChartContainer>
);

type ProjectedTGLDVestingProps = {
  walletAddress?: string;
};

export const ProjectedTGLDVesting = ({
  walletAddress,
}: ProjectedTGLDVestingProps) => {
  const { chartData, userSeries, loading, error } =
    useAdminVestingChart(walletAddress);

  // Memoized formatters to prevent recreation on every render
  // MUST be called before any early returns (Rules of Hooks)
  const yTickFormatter = useCallback(
    (val: number) => `${formatNumberAbbreviated(val).string}\nTGLD`,
    []
  );

  const tooltipLabelFormatter = useCallback(() => 'Grant ID', []);

  const tooltipValuesFormatter = useCallback(
    (data: Metric) => createTooltipContent(data, userSeries),
    [userSeries]
  );

  // Generate series dynamically from userSeries (memoized)
  const series = useMemo(
    () =>
      userSeries.map((user, index) => ({
        key: user.key,
        color: USER_COLORS[index % USER_COLORS.length],
      })),
    [userSeries]
  );

  // Calculate y-axis domain using standard utility (memoized)
  const { yDomain, yTicks } = useMemo(() => {
    const values = calculateChartValues(chartData, userSeries);
    return getYAxisDomainAndTicks(values);
  }, [chartData, userSeries]);

  // Early returns for edge cases (AFTER all hooks)
  if (loading) return <LoadingState />;
  if (chartData.length === 0) return <EmptyState />;

  return (
    <ChartContainer>
      <CustomBarChart<Metric>
        chartData={chartData}
        series={series}
        xDataKey="timestamp"
        xTickFormatter={tickFormatter}
        yTickFormatter={yTickFormatter}
        tooltipLabelFormatter={tooltipLabelFormatter}
        tooltipValuesFormatter={tooltipValuesFormatter}
        yDomain={yDomain}
        yTicks={yTicks}
        lineDataKey="total"
      />
    </ChartContainer>
  );
};

const PageContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
`;

const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Title = styled.h3`
  line-height: 45px;
  font-size: 24px;
  font-weight: 400;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0;
`;

const Legend = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const DashedLine = styled.div`
  width: 30px;
  border-top: 2px dashed ${({ theme }) => theme.palette.brandLight};
`;

const LegendText = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const LoaderContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: ${MIN_CHART_HEIGHT}px;
`;
