import { useEffect, useMemo } from 'react';
import styled from 'styled-components';
import {
  DotChart,
  getBidHistoryYAxisConfig,
  aggregateBidsByBucket,
} from '../../components/Charts';
import Loader from 'components/Loader/Loader';
import { formatNumberFixedDecimals } from 'utils/formatter';
import { Option } from '../../components/InputSelector';
import { useBidHistory } from '../hooks/use-bid-history';

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

  // Use selectedFilters from parent (single selection)
  // If no filter selected, default to the most recent epoch
  const selectedEpoch =
    selectedFilters.length > 0
      ? selectedFilters[0].value
      : historyData?.[historyData.length - 1]?.epoch;

  const epochData = historyData?.find((data) => data.epoch === selectedEpoch);

  const { chartData, bucketIndices, labelMap } = useMemo(
    () => aggregateBidsByBucket(epochData?.bids ?? []),
    [epochData]
  );

  const prices = useMemo(
    () => (epochData?.bids ?? []).map((b) => b.price),
    [epochData]
  );
  const { yDomain, yTicks } = getBidHistoryYAxisConfig(prices);

  if (loading)
    return (
      <LoaderContainer>
        <Loader />
      </LoaderContainer>
    );

  if (error) return <NoDataContainer>{error}</NoDataContainer>;

  if (!historyData || historyData.length === 0)
    return <NoDataContainer>No bid history available</NoDataContainer>;

  if (!epochData || epochData.bids.length === 0) {
    return <NoDataContainer>No bids found for this epoch</NoDataContainer>;
  }

  return (
    <ChartContainer>
      <DotChart
        chartData={chartData}
        xDataKey="bucketIndex"
        yDataKey="price"
        highlightKey="isFinalBid"
        xTicks={bucketIndices}
        xTickFormatter={(bucketIndex: number) =>
          labelMap.get(bucketIndex) || ''
        }
        tooltipLabelFormatter={(bucketIndex: number) =>
          `Time: ${labelMap.get(bucketIndex) || ''}`
        }
        tooltipValuesFormatter={(_value: number, _name: string, props: any) => {
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
