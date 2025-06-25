import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import CustomBarChart from './BarChart';
import Loader from 'components/Loader/Loader';
import { formatNumberAbbreviated } from 'utils/formatter';
import { InputSelect, Option } from '../../components/InputSelector';
import * as breakpoints from 'styles/breakpoints';
import { useStableGoldAuctionMetrics } from '../hooks/use-stableGold-auction-metrics';
import { getYAxisDomainAndTicks } from 'components/Pages/Core/DappPages/SpiceBazaar/components/GetYAxisDomainAndTicks';

export const Chart = () => {
  const { data: metrics, loading } = useStableGoldAuctionMetrics();

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

  // Set default selected auctions on initial load
  useEffect(() => {
    if (auctionOptions.length && selectedAuctions.length === 0) {
      setSelectedAuctions(auctionOptions);
    }
  }, [auctionOptions, selectedAuctions.length]);

  const handleChange = (selected: Option[]) => {
    setSelectedAuctions(selected);
  };

  const chartData = useMemo(() => {
    if (loading || !metrics?.length) return [];

    const data = metrics
      .filter((d) => selectedAuctions.some((option) => option.label === d.date))
      .sort((a, b) => a.timestamp - b.timestamp);

    return data;
  }, [metrics, selectedAuctions, loading]);

  const values = useMemo(() => chartData.map((d) => d.value), [chartData]);
  const { yDomain, yTicks } = getYAxisDomainAndTicks(values);

  if (loading || !metrics?.length) return <Loader />;

  return (
    <PageContainer>
      <HeaderContainer>
        <InputSelect
          options={auctionOptions}
          value={selectedAuctions} // controlled value
          onChange={handleChange}
          width="280px"
          fontSize="1rem"
          maxMenuItems={7}
          textAlloptions="Total $ Bid By TGLD Auction"
        />
      </HeaderContainer>
      <CustomBarChart
        chartData={chartData}
        xDataKey="date"
        yDataKey="value"
        xTickFormatter={(val: any) => val}
        yTickFormatter={(val: any) => {
          const { string } = formatNumberAbbreviated(val);
          return `$${string}`;
        }}
        tooltipLabelFormatter={(value: string) => {
          const found = chartData.find((d) => d.date === value);
          return found?.id ? `Auction ID: ${found.id}` : value;
        }}
        tooltipValuesFormatter={(value: any) => [
          `$${value.toFixed(2)}`,
          'Value',
        ]}
        xAxisTitle="Auction end date"
        yAxisTitle="USDS Bid"
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
