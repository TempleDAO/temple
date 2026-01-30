import { useEffect, useMemo } from 'react';
import styled from 'styled-components';
import BidHistoryDotChart from './BidHistoryDotChart';
import Loader from 'components/Loader/Loader';
import { formatNumberFixedDecimals } from 'utils/formatter';
import { Option } from '../../components/InputSelector';
import { useBidHistory } from '../hooks/use-bid-history';
import { getBidHistoryYAxisConfig } from './bidHistoryYAxisDomain';

type BidHistoryChartProps = {
  auctionTokenAddress?: string;
  selectedFilters: Option[];
  onFilterOptionsChange?: (options: Option[]) => void;
};

export const BidHistoryChart = ({
  auctionTokenAddress,
  selectedFilters,
  onFilterOptionsChange,
}: BidHistoryChartProps) => {
  const {
    data: historyData,
    loading,
    error,
  } = useBidHistory(auctionTokenAddress);

  // Build available epoch filter options from the data
  const epochOptions: Option[] = useMemo(() => {
    if (!historyData) return [];
    return historyData.map((epochData) => ({
      label: epochData.epochLabel,
      value: epochData.epoch,
    }));
  }, [historyData]);

  // Expose available options to parent component
  useEffect(() => {
    if (epochOptions.length > 0 && onFilterOptionsChange) {
      onFilterOptionsChange(epochOptions);
    }
  }, [epochOptions, onFilterOptionsChange]);

  if (loading)
    return (
      <LoaderContainer>
        <Loader />
      </LoaderContainer>
    );

  if (error) return <NoDataContainer>{error}</NoDataContainer>;

  if (!historyData || historyData.length === 0)
    return <NoDataContainer>No bid history available</NoDataContainer>;

  // Use selectedFilters from parent (single selection)
  // If no filter selected, default to the most recent epoch
  const selectedEpoch =
    selectedFilters.length > 0
      ? selectedFilters[0].value
      : historyData[historyData.length - 1].epoch;

  // Find the selected epoch's data
  const epochData = historyData.find((data) => data.epoch === selectedEpoch);

  if (!epochData || epochData.bids.length === 0) {
    return <NoDataContainer>No bids found for this epoch</NoDataContainer>;
  }

  // Group bids by bucket for chart display
  // Each bucket will have multiple dots at the same X position (vertically aligned)
  const chartData = epochData.bids.map((bid) => ({
    bucket: bid.bucket,
    bucketIndex: bid.bucketIndex,
    price: bid.price,
    bidAmount: bid.bidAmount,
    timestamp: bid.timestamp,
    isFinalBid: bid.isFinalBid,
    hash: bid.hash,
  }));

  // Get all unique bucket indices (numeric) for X-axis ticks
  const uniqueBucketIndices = Array.from(
    new Set(chartData.map((d) => d.bucketIndex))
  ).sort((a, b) => a - b);

  // Create a lookup map: bucketIndex → bucket label
  const bucketIndexToLabel = new Map<number, string>();
  chartData.forEach((d) => {
    if (!bucketIndexToLabel.has(d.bucketIndex)) {
      bucketIndexToLabel.set(d.bucketIndex, d.bucket);
    }
  });

  // Get all prices for Y-axis calculation
  const prices = chartData.map((d) => d.price);

  // Calculate Y-axis domain and ticks (starts at 0, ends slightly above max)
  // Explicit ticks ensure exactly 5 evenly spaced grid lines
  const { yDomain, yTicks } = getBidHistoryYAxisConfig(prices);

  return (
    <ChartContainer>
      <BidHistoryDotChart
        chartData={chartData}
        xDataKey="bucketIndex"
        yDataKey="price"
        isFinalBidKey="isFinalBid"
        xTicks={uniqueBucketIndices}
        xTickFormatter={(bucketIndex: number) =>
          bucketIndexToLabel.get(bucketIndex) || ''
        }
        tooltipLabelFormatter={(bucketIndex: number) =>
          `Time: ${bucketIndexToLabel.get(bucketIndex) || ''}`
        }
        tooltipValuesFormatter={(value: any, name: string, props: any) => {
          const bid = props.payload;
          const priceFormatted = formatNumberFixedDecimals(bid.price, 6);
          const bidAmountFormatted = formatNumberFixedDecimals(
            parseFloat(bid.bidAmount),
            2
          );
          return `Bid Amount: ${bidAmountFormatted} TGLD\nPrice Ratio: ${priceFormatted} TGLD/${epochData.auctionTokenSymbol}`;
        }}
        xAxisTitle="Time"
        yAxisTitle={`TGLD/${epochData.auctionTokenSymbol}`}
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
