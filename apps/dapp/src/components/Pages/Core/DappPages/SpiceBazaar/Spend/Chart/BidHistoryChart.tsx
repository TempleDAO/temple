import { useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { DotChart } from '../../components/Charts';
import Loader from 'components/Loader/Loader';
import { formatNumberFixedDecimals } from 'utils/formatter';
import { Option } from '../../components/InputSelector';
import { useBidHistory } from '../hooks/use-bid-history';
import { getBidHistoryYAxisConfig } from '../../components/Charts';

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

  // Aggregate bids by bucket: one dot per bucket, sized by bid count.
  // Average the prices, sum bid amounts, track count for radius scaling.
  const bucketMap = new Map<
    number,
    {
      bucket: string;
      bucketIndex: number;
      prices: number[];
      totalBidAmount: number;
      count: number;
      isFinalBid: boolean;
    }
  >();
  epochData.bids.forEach((bid) => {
    const existing = bucketMap.get(bid.bucketIndex);
    if (existing) {
      existing.prices.push(bid.price);
      existing.totalBidAmount += parseFloat(bid.bidAmount);
      existing.count += 1;
      if (bid.isFinalBid) existing.isFinalBid = true;
    } else {
      bucketMap.set(bid.bucketIndex, {
        bucket: bid.bucket,
        bucketIndex: bid.bucketIndex,
        prices: [bid.price],
        totalBidAmount: parseFloat(bid.bidAmount),
        count: 1,
        isFinalBid: bid.isFinalBid,
      });
    }
  });

  const maxCount = Math.max(
    ...Array.from(bucketMap.values()).map((b) => b.count)
  );

  const chartData = Array.from(bucketMap.values()).map((b) => ({
    bucket: b.bucket,
    bucketIndex: b.bucketIndex,
    price: b.prices.reduce((sum, p) => sum + p, 0) / b.prices.length,
    minPrice: Math.min(...b.prices),
    maxPrice: Math.max(...b.prices),
    totalBidAmount: b.totalBidAmount,
    count: b.count,
    maxCount,
    isFinalBid: b.isFinalBid,
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

  // Use all individual bid prices (not averages) for Y-axis range
  const prices = epochData.bids.map((b) => b.price);

  // Calculate Y-axis domain and ticks (starts at 0, ends slightly above max)
  // Explicit ticks ensure exactly 5 evenly spaced grid lines
  const { yDomain, yTicks } = getBidHistoryYAxisConfig(prices);

  return (
    <ChartContainer>
      <DotChart
        chartData={chartData}
        xDataKey="bucketIndex"
        yDataKey="price"
        highlightKey="isFinalBid"
        xTicks={uniqueBucketIndices}
        xTickFormatter={(bucketIndex: number) =>
          bucketIndexToLabel.get(bucketIndex) || ''
        }
        tooltipLabelFormatter={(bucketIndex: number) =>
          `Time: ${bucketIndexToLabel.get(bucketIndex) || ''}`
        }
        tooltipValuesFormatter={(_value: any, _name: string, props: any) => {
          const d = props.payload;
          const avgFormatted = formatNumberFixedDecimals(d.price, 6);
          const totalFormatted = formatNumberFixedDecimals(d.totalBidAmount, 2);
          const lines = [
            `Bids: ${d.count}`,
            `Total Amount: ${totalFormatted} TGLD`,
          ];
          if (d.count > 1) {
            const minFormatted = formatNumberFixedDecimals(d.minPrice, 6);
            const maxFormatted = formatNumberFixedDecimals(d.maxPrice, 6);
            lines.push(
              `Avg Price: ${avgFormatted} TGLD/${epochData.auctionTokenSymbol}`
            );
            lines.push(`Price Range: ${minFormatted} – ${maxFormatted}`);
          } else {
            lines.push(
              `Price: ${avgFormatted} TGLD/${epochData.auctionTokenSymbol}`
            );
          }
          return lines.join('\n');
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
