import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import CustomBarChart from './BarChart';
import Loader from 'components/Loader/Loader';
import { formatNumberAbbreviated } from 'utils/formatter';
import { InputSelect, Option } from '../../components/InputSelector';
import * as breakpoints from 'styles/breakpoints';
import { useClosingPriceHistory } from '../hooks/use-closing-price-history';
import { getYAxisDomainAndTicks } from 'components/Pages/Core/DappPages/SpiceBazaar/components/GetYAxisDomainAndTicks';

type ChartProps = {
  auctionAddress: string;
};

export const Chart = ({ auctionAddress }: ChartProps) => {
  const { data: metrics, loading } = useClosingPriceHistory(auctionAddress);

  const auctionOptions: Option[] = useMemo(() => {
    const seen = new Set();
    return (metrics ?? [])
      .filter((m) => {
        const key = m.date;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((m) => ({
        label: m.date,
        value: m.date.toLowerCase().replace(/\s/g, '-'),
      }));
  }, [metrics]);

  const [selectedAuctions, setSelectedAuctions] = useState<Option[]>([]);

  useEffect(() => {
    if (auctionOptions.length && selectedAuctions.length === 0) {
      setSelectedAuctions(auctionOptions);
    }
  }, [auctionOptions]);

  const handleChange = (selected: Option[]) => {
    setSelectedAuctions(selected);
  };

  if (loading) return <Loader />;
  if (!metrics || metrics.length === 0)
    return <div>No chart data available</div>;

  const chartData = metrics
    .filter((d) => selectedAuctions.some((option) => option.label === d.date))
    .sort((a, b) => a.timestamp - b.timestamp);

  const values = chartData.map((d) => d.value);

  const { yDomain, yTicks } = getYAxisDomainAndTicks(values);

  return (
    <PageContainer>
      <HeaderContainer>
        <ChartTitle>Closing Price History</ChartTitle>
        <InputSelect
          options={auctionOptions}
          defaultValue={auctionOptions}
          value={selectedAuctions}
          onChange={handleChange}
          width="150px"
          fontSize="1rem"
          maxMenuItems={7}
          textAlloptions="All Auctions"
        />
      </HeaderContainer>
      <CustomBarChart
        chartData={chartData}
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
        yAxisDomain={yDomain}
        yAxisTicks={yTicks}
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
