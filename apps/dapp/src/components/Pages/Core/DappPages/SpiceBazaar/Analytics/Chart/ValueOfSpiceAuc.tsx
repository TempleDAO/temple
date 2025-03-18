import { useState } from 'react';
import styled, { useTheme } from 'styled-components';
import { subDays } from 'date-fns';
import { format } from 'date-fns';
import { formatNumberAbbreviated } from 'utils/formatter';
import { InputSelect } from 'components/InputSelect/InputSelect';
import CustomBarChart from './BarChart';

type XAxisTickFormatter = (timestamp: number) => string;

export const tickFormatter: XAxisTickFormatter = (timestamp) =>
  format(new Date(timestamp), 'MMM dd');

export type Metric = {
  timestamp: number;
  value1: number;
  value2: number;
  value3: number;
  value4: number;
};

const pricesLast7Days: Metric[] = [
  {
    timestamp: subDays(new Date(), 9).getTime(),
    value1: 1.0,
    value2: 0.4,
    value3: 1.6,
    value4: 1.1,
  },
  {
    timestamp: subDays(new Date(), 8).getTime(),
    value1: 1.8,
    value2: 1.0,
    value3: 0.5,
    value4: 0.5,
  },
  {
    timestamp: subDays(new Date(), 7).getTime(),
    value1: 1.9,
    value2: 0.2,
    value3: 1.0,
    value4: 1.0,
  },
  {
    timestamp: subDays(new Date(), 6).getTime(),
    value1: 2.5,
    value2: 0.0,
    value3: 1.0,
    value4: 1.0,
  },
  {
    timestamp: subDays(new Date(), 5).getTime(),
    value1: 1.6,
    value2: 0.0,
    value3: 1.0,
    value4: 1.0,
  },
  {
    timestamp: subDays(new Date(), 4).getTime(),
    value1: 1.0,
    value2: 1.0,
    value3: 0.8,
    value4: 0.7,
  },
  {
    timestamp: subDays(new Date(), 3).getTime(),
    value1: 2.2,
    value2: 0.2,
    value3: 2.0,
    value4: 1.0,
  },
  {
    timestamp: subDays(new Date(), 2).getTime(),
    value1: 0.8,
    value2: 0.0,
    value3: 0.5,
    value4: 0.3,
  },
  {
    timestamp: subDays(new Date(), 1).getTime(),
    value1: 1.7,
    value2: 0.7,
    value3: 2.0,
    value4: 1.0,
  },
  {
    timestamp: new Date().getTime(),
    value1: 1.9,
    value2: 0.0,
    value3: 1.7,
    value4: 1.0,
  },
];

const series = [
  { key: 'value1', color: '#FFDEC9' },
  { key: 'value2', color: '#D0BE75' },
  { key: 'value3', color: '#BD7B4F' },
  { key: 'value4', color: '#95613F' },
];

const metricOptions1: { value: string; label: string }[] = [
  { label: 'Token', value: 'token' },
  { label: 'Opt 2', value: 'opt2' },
  { label: 'Opt 3', value: 'opt3' },
];

const metricOptions2: { value: string; label: string }[] = [
  { label: 'Auction End Date', value: 'auctionEndDate' },
  { label: 'Opt 2', value: 'opt2' },
  { label: 'Opt 3', value: 'opt3' },
];

export const ValueOfSpiceAuc = () => {
  const theme = useTheme();
  const metrics = pricesLast7Days;

  const [selectedMetric1, setSelectedMetric1] = useState('token');
  const [selectedMetric2, setSelectedMetric2] = useState('auctionEndDate');

  const selectMetric1 = (metric: string) => {
    setSelectedMetric1(metric);
  };
  const selectMetric2 = (metric: string) => {
    setSelectedMetric2(metric);
  };

  return (
    <PageContainer>
      <HeaderContainer>
        <Title>Value of Spice Auctions</Title>
        <Options>
          <SelectMetricContainer1>
            <InputSelect
              options={metricOptions1}
              defaultValue={metricOptions1.find(
                (m) => m.value === selectedMetric1
              )}
              onChange={(e) => selectMetric1(e.value)}
              isSearchable={false}
              fontSize={'16px'}
              fontWeight={'400'}
            />
          </SelectMetricContainer1>
          <SelectMetricContainer2>
            <InputSelect
              options={metricOptions2}
              defaultValue={metricOptions2.find(
                (m) => m.value === selectedMetric2
              )}
              onChange={(e) => selectMetric2(e.value)}
              isSearchable={false}
              fontSize={'16px'}
              fontWeight={'400'}
            />
          </SelectMetricContainer2>
        </Options>
      </HeaderContainer>
      <CustomBarChart
        chartData={metrics}
        series={series}
        xDataKey="timestamp"
        xTickFormatter={tickFormatter}
        yTickFormatter={(val) =>
          `$${formatNumberAbbreviated(val).number.toFixed(2)}\u00A0M`
        }
        tooltipLabelFormatter={tickFormatter}
        yDomain={[1.0, 2.5, 4.0, 5.5]}
        tooltipValuesFormatter={(value) => [`$ ${value.toFixed(2)} M`, 'Value']}
      />
    </PageContainer>
  );
};

const PageContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
`;

const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  flex-direction: row;
`;

const Title = styled.h3`
  line-height: 45px;
  font-size: 24px;
  font-weight: 400;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0px;
`;

const Options = styled.div`
  display: flex;
  flex-direction: row;
  gap: 20px;
  width: 320px;
`;

const SelectMetricContainer1 = styled.div`
  flex: 1;
  max-width: 100px;
`;

const SelectMetricContainer2 = styled.div`
  flex: 1;
  max-width: 195px;
`;
