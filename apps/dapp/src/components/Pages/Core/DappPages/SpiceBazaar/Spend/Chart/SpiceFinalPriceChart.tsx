import { useEffect, useMemo } from 'react';
import styled from 'styled-components';
import CustomBarChart from './BarChart';
import Loader from 'components/Loader/Loader';
import { formatNumberFixedDecimals } from 'utils/formatter';
import { Option } from '../../components/InputSelector';
import { useClosingPriceHistory } from '../hooks/use-closing-price-history';
import { getYAxisDomainAndTicks } from 'components/Pages/Core/DappPages/SpiceBazaar/components/GetYAxisDomainAndTicks';

type SpiceFinalPriceChartProps = {
  auctionAddress: string;
  selectedFilters: Option[];
  onFilterOptionsChange?: (options: Option[]) => void;
};

export const SpiceFinalPriceChart = ({
  auctionAddress,
  selectedFilters,
  onFilterOptionsChange,
}: SpiceFinalPriceChartProps) => {
  const {
    data: metrics,
    loading,
    error,
  } = useClosingPriceHistory(auctionAddress);

  // Build available filter options from the data
  // Use timestamp as unique identifier to avoid collapsing auctions on same day
  const auctionOptions: Option[] = useMemo(() => {
    const seen = new Set();
    return (metrics ?? [])
      .filter((m) => {
        const key = m.timestamp; // Use timestamp for deduplication
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((m) => ({
        label: m.date, // Display formatted date (e.g., "30 Jan")
        value: m.timestamp.toString(), // Use timestamp as unique value
      }));
  }, [metrics]);

  // Expose available options to parent component
  useEffect(() => {
    if (auctionOptions.length > 0 && onFilterOptionsChange) {
      onFilterOptionsChange(auctionOptions);
    }
  }, [auctionOptions, onFilterOptionsChange]);

  if (loading)
    return (
      <LoaderContainer>
        <Loader />
      </LoaderContainer>
    );

  if (error) return <NoDataContainer>{error}</NoDataContainer>;

  if (!metrics || metrics.length === 0)
    return <NoDataContainer>No chart data available</NoDataContainer>;

  // Use selectedFilters from parent, or show all if none selected
  const activeFilters =
    selectedFilters.length > 0 ? selectedFilters : auctionOptions;

  const chartData = metrics
    .filter((d) =>
      activeFilters.some((option) => option.value === d.timestamp.toString())
    )
    .sort((a, b) => a.timestamp - b.timestamp);

  const values = chartData.map((d) => d.value);

  const { yDomain, yTicks } = getYAxisDomainAndTicks(values);

  return (
    <ChartContainer>
      <CustomBarChart
        chartData={chartData}
        xDataKey="date"
        yDataKey="value"
        xTickFormatter={(val: any) => val}
        tooltipLabelFormatter={(value: any) => value}
        tooltipValuesFormatter={(value: any) => [
          `${
            typeof value === 'number' ? formatNumberFixedDecimals(value, 2) : 0
          } TGLD`,
          'Value',
        ]}
        xAxisTitle="Auction end date"
        yAxisDomain={yDomain}
        yAxisTicks={yTicks}
      />
    </ChartContainer>
  );
};

const ChartContainer = styled.div`
  width: 100%;
`;

const LoaderContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 350px;
`;

const NoDataContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 350px;
  color: ${({ theme }) => theme.palette.brand};
  font-size: 16px;
`;
