import { useEffect, useState } from 'react';
import styled, { useTheme } from 'styled-components';
import LineChart from './LineChart';

const chartData = [
  { month: 'January', vest1: 100_000, vest2: null },
  { month: 'February', vest1: 200_000, vest2: null },
  { month: 'March', vest1: 400_000, vest2: null },
  { month: 'April', vest1: 600_000, vest2: null },
  { month: 'May', vest1: 750_000, vest2: null },
  { month: 'June', vest1: 850_000, vest2: null },
  { month: 'July', vest1: 875_000, vest2: 100_000 },
  { month: 'August', vest1: 900_090, vest2: 201_910 },
  { month: 'September', vest1: 1_100_000, vest2: 350_000 },
  { month: 'October', vest1: 1_300_000, vest2: 450_000 },
  { month: 'November', vest1: null, vest2: null },
  { month: 'December', vest1: null, vest2: null },
];

export const Chart = () => {
  const theme = useTheme();
  const [metrics, setMetrics] = useState(chartData);

  return (
    <PageContainer>
      <LineChart
        chartData={metrics}
        xDataKey="month"
        lines={[
          { series: 'vest1', color: theme.palette.brandLight },
          { series: 'vest2', color: '#D0BE75' },
        ]}
        xTickFormatter={(val: string) => val.charAt(0)}
        yTickFormatter={(val: any) => {
          const num = val / 1_000_000;
          return `${num.toFixed(1)} M\nTGLD`;
        }}
        tooltipLabelFormatter={(month: string) => `${month} 2025`}
        tooltipValuesFormatter={(value: number, name: string) => {
          const label = name === 'vest1' ? 'Vest 1' : 'Vest 2';
          return [`${value.toLocaleString()}`, label];
        }}
        legendFormatter={(value: any) =>
          value === 'vest1' ? 'VEST 1' : value === 'vest2' ? 'VEST 2' : value
        }
        yDomain={[0, 1_600_000]}
      />
    </PageContainer>
  );
};

const PageContainer = styled.div`
  height: 100%;
`;
