import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { subHours } from 'date-fns';
import LineChart from './LineChart';
import CustomBarChart from './BarChart';
import Loader from 'components/Loader/Loader';
import { formatNumberAbbreviated } from 'utils/formatter';
import { InputSelect, Option } from './InputSelector';
import * as breakpoints from 'styles/breakpoints';

const tickFormatter = (timestamp: number) => {
  const hoursAgo = Math.floor(
    (new Date().getTime() - timestamp) / (1000 * 60 * 60)
  );
  return `${hoursAgo}h`;
};

type Metric = { date: string; value: number };

const data = [
  { date: 'Mar 10', value: 3.0 },
  { date: 'Apr 10', value: 3.1 },
  { date: 'Jun 15', value: 3.2 },
  { date: 'Jul 9', value: 2.0 },
  { date: 'Aug 12', value: 3.2 },
  { date: 'Sep 12', value: 1.5 },
  { date: 'Oct 12', value: 3.0 },
];

const auctionOptions = [
  { label: 'Mar 10', value: 'mar-10' },
  { label: 'Apr 10', value: 'apr-10' },
  { label: 'Jun 15', value: 'jun-15' },
  { label: 'Jul 9', value: 'jul-9' },
  { label: 'Aug 12', value: 'aug-12' },
  { label: 'Sep 12', value: 'sep-12' },
  { label: 'Oct 12', value: 'oct-12' },
];

export const Chart = () => {
  const [metrics, setMetrics] = useState<Metric[]>([]);

  useEffect(() => {
    setMetrics(data);
  }, []);

  const [selectedAuctions, setSelectedAuctions] = useState<Option[]>([
    auctionOptions[0],
    auctionOptions[1],
    auctionOptions[2],
    auctionOptions[3],
    auctionOptions[4],
    auctionOptions[5],
    auctionOptions[6],
  ]);

  const handleChange = (selected: Option[]) => {
    setSelectedAuctions(selected);
  };

  if (!metrics.length) return <Loader />;

  return (
    <PageContainer>
      <HeaderContainer>
        <ChartTitle>Closing Price History</ChartTitle>
        <InputSelect
          options={auctionOptions}
          defaultValue={selectedAuctions}
          onChange={handleChange}
          width="150px"
          fontSize="1rem"
          maxMenuItems={7}
        />
      </HeaderContainer>
      <CustomBarChart
        chartData={data.filter((d) =>
          selectedAuctions.some((option) => option.label === d.date)
        )}
        xDataKey="date"
        yDataKey="value"
        xTickFormatter={(val: any) => val}
        yTickFormatter={(val: any) =>
          `$${formatNumberAbbreviated(val).number.toFixed(2)}`
        }
        tooltipLabelFormatter={() => 'Auction ID'}
        tooltipValuesFormatter={(value: any) => [
          `$${value.toFixed(2)}`,
          'Value',
        ]}
        xAxisTitle="Auction end date"
      />
    </PageContainer>
  );
};

const PageContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const HeaderContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;

  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
    gap: 40px;
    align-items: center;
  `)}
`;

const ChartTitle = styled.div`
  color: ${({ theme }) => theme.palette.brand};
  font-size: 16px;
  line-height: 19px;
`;
