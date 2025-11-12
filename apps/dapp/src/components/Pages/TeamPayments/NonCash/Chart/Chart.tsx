import { useMemo, useState } from 'react';
import styled, { useTheme } from 'styled-components';
import LineChart from './LineChart';
import { useVestingChart } from '../hooks/use-vesting-chart';
import { useVestingMetrics } from '../hooks/use-vesting-metrics';
import { useDummyVestingSchedules } from '../hooks/use-dummy-vesting-data';
import Loader from 'components/Loader/Loader';
import { Button } from 'components/Button/Button';
import { getYAxisDomainAndTicks } from 'components/Pages/Core/DappPages/SpiceBazaar/components/GetYAxisDomainAndTicks';

// Additional colors for vests 3, 4, 5
const ADDITIONAL_COLORS = ['#FF6B6B', '#4ECDC4', '#95E1D3'];

export const Chart = () => {
  const theme = useTheme();
  const [useDummyData, setUseDummyData] = useState(false);

  // Get schedules from either real or dummy source
  const realSchedules = useVestingMetrics();
  const dummySchedules = useDummyVestingSchedules();

  // Select which schedules to use
  const selectedSchedules = useDummyData
    ? dummySchedules.schedules
    : realSchedules.schedules;

  // Process schedules into chart data
  const { data, loading, error } = useVestingChart({
    schedules: selectedSchedules,
  });

  // Generate colors for each vest line
  const colors = [theme.palette.brandLight, '#D0BE75', ...ADDITIONAL_COLORS];

  // Dynamically generate lines based on data
  const lines = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Get all vest keys (vest1, vest2, etc.) from first data point
    const vestKeys = Object.keys(data[0]).filter((key) =>
      key.startsWith('vest')
    );

    return vestKeys.map((key, index) => ({
      series: key,
      color: colors[index % colors.length],
    }));
  }, [data, colors]);

  // Calculate y-axis domain using standard utility
  const { yDomain, yTicks } = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        yDomain: [0, 200] as [number, number],
        yTicks: [0, 50, 100, 150, 200],
      };
    }

    const values: number[] = [];
    data.forEach((point) => {
      Object.keys(point).forEach((key) => {
        if (key !== 'month' && typeof point[key] === 'number') {
          values.push(point[key] as number);
        }
      });
    });

    return getYAxisDomainAndTicks(values);
  }, [data]);

  if (loading) {
    return (
      <PageContainer>
        <LoaderContainer>
          <Loader iconSize={48} />
        </LoaderContainer>
      </PageContainer>
    );
  }

  if (error || !data || data.length === 0) {
    return (
      <PageContainer>
        <ErrorMessage>{error || 'No vesting data available'}</ErrorMessage>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <ChartHeader>
        <ToggleDataButton
          onClick={() => setUseDummyData(!useDummyData)}
          isActive={useDummyData}
        >
          {useDummyData ? 'Dummy Data' : 'Subgraph Data'}
        </ToggleDataButton>
      </ChartHeader>
      <LineChart
        chartData={data}
        xDataKey="month"
        lines={lines}
        xTickFormatter={(val: string) => {
          // Extract first letter of month (J, F, M, etc.)
          const month = val.split(' ')[0];
          return month.charAt(0);
        }}
        yTickFormatter={(val: any) => {
          // Format as "40 TGLD" or "0.5 M TGLD" depending on scale
          if (val >= 1_000_000) {
            const num = val / 1_000_000;
            return `${num.toFixed(1)} M\nTGLD`;
          }
          return `${val.toLocaleString()}\nTGLD`;
        }}
        tooltipLabelFormatter={(month: string) => month}
        tooltipValuesFormatter={(value: number, name: string) => {
          // Convert vest1 -> Vest 1, vest2 -> Vest 2, etc.
          const vestNum = name.replace('vest', '');
          const label = `Vest ${vestNum}`;
          return [`${value.toLocaleString()}`, label];
        }}
        legendFormatter={(value: any) => {
          // Convert vest1 -> VEST 1, vest2 -> VEST 2, etc.
          if (value.startsWith('vest')) {
            const num = value.replace('vest', '');
            return `VEST ${num}`;
          }
          return value;
        }}
        yDomain={yDomain}
        yTicks={yTicks}
      />
    </PageContainer>
  );
};

const PageContainer = styled.div`
  height: 100%;
`;

const ChartHeader = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: 0 0 12px 0;
`;

const ToggleDataButton = styled(Button)`
  padding: 10px 20px;
  width: 150px;
  height: min-content;
  background: ${({ theme }) => theme.palette.gradients.dark};
  border: ${({ disabled, theme }) =>
    disabled ? 'none' : `1px solid ${theme.palette.brandDark}`};
  box-shadow: ${({ disabled }) =>
    disabled ? 'none' : '0px 0px 20px 0px rgba(222, 92, 6, 0.4)'};
  border-radius: 10px;
  font-weight: 700;
  font-size: 12px;
  line-height: 20px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const LoaderContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
`;

const ErrorMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
  color: ${({ theme }) => theme.palette.brand};
  font-size: 16px;
`;
