import styled from 'styled-components';
import { format } from 'date-fns';
import { formatNumberAbbreviated } from 'utils/formatter';
import CustomBarChart from './BarChart';

export type Metric = {
  timestamp: number;
  value1: number;
  value2: number;
  value3: number;
  value4: number;
  runway: number;
};

const tickFormatter = (timestamp: number): string =>
  format(new Date(timestamp), 'MMM');

const series: { key: keyof Metric; color: string }[] = [
  { key: 'value1', color: '#FFDEC9' },
  { key: 'value2', color: '#D0BE75' },
  { key: 'value3', color: '#BD7B4F' },
  { key: 'value4', color: '#95613F' },
];

const vestedTGLDData = [
  {
    timestamp: 1704067200000,
    value1: 200000,
    value2: 250000,
    value3: 300000,
    value4: 246920,
  },
  {
    timestamp: 1706745600000,
    value1: 200000,
    value2: 250000,
    value3: 250000,
    value4: 200000,
  },
  {
    timestamp: 1709251200000,
    value1: 220000,
    value2: 270000,
    value3: 240000,
    value4: 210000,
  },
  {
    timestamp: 1711939200000,
    value1: 230000,
    value2: 150000,
    value3: 200000,
    value4: 120000,
  },
  {
    timestamp: 1714521600000,
    value1: 250000,
    value2: 100000,
    value3: 150000,
    value4: 100000,
  },
  {
    timestamp: 1717200000000,
    value1: 200000,
    value2: 230000,
    value3: 200000,
    value4: 180000,
  },
  {
    timestamp: 1719792000000,
    value1: 300000,
    value2: 250000,
    value3: 200000,
    value4: 150000,
  },
  {
    timestamp: 1722470400000,
    value1: 180000,
    value2: 240000,
    value3: 280000,
    value4: 210000,
  },
  {
    timestamp: 1725062400000,
    value1: 150000,
    value2: 130000,
    value3: 170000,
    value4: 120000,
  },
  {
    timestamp: 1727740800000,
    value1: 400000,
    value2: 330000,
    value3: 250000,
    value4: 180000,
  },
  {
    timestamp: 1730332800000,
    value1: 100000,
    value2: 200000,
    value3: 230000,
    value4: 180000,
  },
  {
    timestamp: 1733011200000,
    value1: 250000,
    value2: 180000,
    value3: 200000,
    value4: 150000,
  },
];

export const ProjectedTGLDVesting = () => {
  const metrics: Metric[] = vestedTGLDData.map((item) => ({
    ...item,
    runway: item.value1 + item.value2 + item.value3 + item.value4 + 200000,
  }));

  const totalPerMonth = metrics.map(
    (item) => item.value1 + item.value2 + item.value3 + item.value4
  );

  const tooltipFormatterFn = (data: Metric): string[] => {
    const grantValue = data.value4 ?? 0;
    const monthTotal = data.value1 + data.value2 + data.value3 + data.value4;
    const percent = monthTotal
      ? ((grantValue / monthTotal) * 100).toFixed(0)
      : '0';
    const dateLabel = tickFormatter(data.timestamp);

    return [
      `Amount to be vested: ${grantValue.toLocaleString()} TGLD`,
      `Percentage of total amount to be vested in ${dateLabel} 2024:`,
      `${grantValue.toLocaleString()} / ${monthTotal.toLocaleString()} = ${percent}%`,
    ];
  };

  return (
    <PageContainer>
      <HeaderContainer>
        <Title>Projected TGLD Vesting By Month</Title>
        <Legend>
          <DashedLine />
          <LegendText>TGLD balance runway</LegendText>
        </Legend>
      </HeaderContainer>

      <CustomBarChart<Metric>
        chartData={metrics}
        series={series}
        xDataKey="timestamp"
        xTickFormatter={tickFormatter}
        yTickFormatter={(val) => `${formatNumberAbbreviated(val).string} TGLD`}
        tooltipLabelFormatter={() => 'Grant ID'}
        tooltipValuesFormatter={tooltipFormatterFn}
        yDomain={[0, 1_500_000]}
        lineDataKey="runway"
      />
    </PageContainer>
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
