import { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { BarChart as CustomBarChart, DotChart } from '../../components/Charts';
import Loader from 'components/Loader/Loader';
import { formatNumberAbbreviated } from 'utils/formatter';
import {
  InputSelect as MultiInputSelect,
  Option,
} from '../../components/InputSelector';
import {
  InputSelect as SingleInputSelect,
  type Option as SingleOption,
} from 'components/InputSelect/InputSelect';
import {
  useStableGoldAuctionMetrics,
  MetricType,
} from '../hooks/use-stableGold-auction-metrics';
import {
  getYAxisDomainAndTicks,
  getBidHistoryYAxisConfig,
  aggregateBidsByBucket,
} from '../../components/Charts';
import { useAuctionsHistory } from '../hooks/use-auctions-history';
import { useBidsHistory } from '../hooks/use-bids-history';

// ChartView extends the data-layer MetricType with the UI-only 'bidHistory'
// mode, which uses a separate data source and cannot be used to index Metric.
type ChartView = MetricType | 'bidHistory';

const metricOptions: { value: ChartView; label: string }[] = [
  { value: 'tgldFinalPrice', label: 'TGLD Final Price' },
  { value: 'totalUsdsBid', label: 'Total USDS Bid' },
  { value: 'tgldInCirculation', label: 'TGLD in Circulation' },
  { value: 'bidHistory', label: 'Bid History' },
];

export const TgldAuctionChart = () => {
  const { data: metrics, loading: metricsLoading } =
    useStableGoldAuctionMetrics();
  const { data: auctionsData, loading: auctionsLoading } = useAuctionsHistory();

  const [selectedMetric, setSelectedMetric] =
    useState<ChartView>('tgldFinalPrice');

  const isBidHistory = selectedMetric === 'bidHistory';

  // --- Epoch options for bid history single-select ---
  const epochOptions: SingleOption[] = useMemo(() => {
    if (!auctionsData) return [];
    return [...auctionsData]
      .sort((a, b) => Number(b.epoch) - Number(a.epoch))
      .map((a) => {
        const endDate = new Date(Number(a.endTime) * 1000).toLocaleDateString(
          'en-GB',
          { day: 'numeric', month: 'short', year: 'numeric' }
        );
        return {
          value: a.epoch,
          label: `Epoch ${a.epoch} - ${endDate}`,
        };
      });
  }, [auctionsData]);

  const [selectedEpoch, setSelectedEpoch] = useState<SingleOption | undefined>(
    undefined
  );

  // Default to most recent epoch once data loads
  useEffect(() => {
    if (epochOptions.length > 0 && !selectedEpoch) {
      setSelectedEpoch(epochOptions[0]);
    }
  }, [epochOptions, selectedEpoch]);

  const handleEpochChange = (selected: SingleOption) => {
    setSelectedEpoch(selected);
  };

  // Fetch bids for the selected epoch (only triggers when epoch changes)
  const epochStr = isBidHistory ? (selectedEpoch?.value as string) : undefined;
  const { chartData: bidChartData, loading: bidsLoading } =
    useBidsHistory(epochStr);

  // --- Multi-select auctions (for bar charts) ---
  const auctionOptions: Option[] = useMemo(() => {
    return (metrics ?? [])
      .slice()
      .reverse()
      .map((m) => ({
        label: `${m.date} ${new Date(m.timestamp * 1000).getFullYear()}`,
        value: m.timestamp.toString(),
      }));
  }, [metrics]);

  const [selectedAuctions, setSelectedAuctions] = useState<Option[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && auctionOptions.length) {
      setSelectedAuctions(auctionOptions);
      initialized.current = true;
    }
  }, [auctionOptions]);

  const handleAuctionChange = (selected: Option[]) => {
    setSelectedAuctions(selected);
  };

  const handleMetricChange = (selected: {
    value: ChartView;
    label: string;
  }) => {
    setSelectedMetric(selected.value);
  };

  // --- Bar chart data (for non-bidHistory metrics) ---
  const barChartData = useMemo(() => {
    if (metricsLoading || !metrics?.length || isBidHistory) return [];

    // isBidHistory guard above ensures selectedMetric is a valid MetricType key
    const metricKey = selectedMetric as MetricType;
    return metrics
      .filter((d) =>
        selectedAuctions.some(
          (option) => option.value === d.timestamp.toString()
        )
      )
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((d) => ({
        ...d,
        value: d[metricKey] as number,
      }));
  }, [metrics, selectedAuctions, selectedMetric, metricsLoading, isBidHistory]);

  const barValues = useMemo(
    () => barChartData.map((d) => d.value),
    [barChartData]
  );
  const { yDomain: barYDomain, yTicks: barYTicks } =
    getYAxisDomainAndTicks(barValues);

  // --- Dot chart data (for bidHistory, single-epoch bucketed) ---
  const dotAggregated = useMemo(
    () => aggregateBidsByBucket(bidChartData?.bids ?? []),
    [bidChartData]
  );

  const dotPrices = useMemo(
    () => dotAggregated.chartData.map((d) => d.price),
    [dotAggregated]
  );
  const { yDomain: dotYDomain, yTicks: dotYTicks } =
    getBidHistoryYAxisConfig(dotPrices);

  // --- Chart config for bar metrics ---
  const getChartConfig = () => {
    switch (selectedMetric) {
      case 'totalUsdsBid':
        return {
          yAxisTitle: 'USDS Bid',
          yTickFormatter: (val: any) => {
            const { string } = formatNumberAbbreviated(val);
            return `$${string}`;
          },
          tooltipValuesFormatter: (value: any) => [
            `$${value.toFixed(2)}`,
            'USDS Bid',
          ],
        };
      case 'tgldFinalPrice':
        return {
          yAxisTitle: 'TGLD Price (USDS)',
          yTickFormatter: (val: any) => {
            return val < 0.01 ? '<0.01' : val.toFixed(4);
          },
          tooltipValuesFormatter: (value: any) => [
            `${value.toFixed(4)} USDS`,
            'TGLD Price',
          ],
        };
      case 'tgldInCirculation':
        return {
          yAxisTitle: 'TGLD in Circulation',
          yTickFormatter: (val: any) => {
            const { string } = formatNumberAbbreviated(val);
            return `${string}`;
          },
          tooltipValuesFormatter: (value: any) => [
            `${formatNumberAbbreviated(value).string} TGLD`,
            'In Circulation',
          ],
        };
      default:
        return {
          yAxisTitle: 'Value',
          yTickFormatter: (val: any) => val.toString(),
          tooltipValuesFormatter: (value: any) => [value.toString(), 'Value'],
        };
    }
  };

  const chartConfig = getChartConfig();

  const loading = isBidHistory
    ? bidsLoading || auctionsLoading
    : metricsLoading;

  if (loading) return <Loader />;
  if (!isBidHistory && !metrics?.length) return <p>No data available.</p>;

  return (
    <PageContainer>
      <HeaderContainer>
        <SelectWrapper>
          <SingleInputSelect
            options={metricOptions}
            defaultValue={metricOptions.find(
              (option) => option.value === selectedMetric
            )}
            onChange={handleMetricChange}
            fontSize="1rem"
            textAlign="left"
            fontWeight="normal"
            maxMenuItems={7}
            isSearchable={false}
          />
        </SelectWrapper>

        {isBidHistory ? (
          <SelectWrapper>
            <SingleInputSelect
              options={epochOptions}
              value={selectedEpoch}
              onChange={handleEpochChange}
              width="280px"
              fontSize="1rem"
              maxMenuItems={7}
              isSearchable={false}
            />
          </SelectWrapper>
        ) : (
          <SelectWrapper>
            <MultiInputSelect
              options={auctionOptions}
              value={selectedAuctions}
              onChange={handleAuctionChange}
              fontSize="1rem"
              textAlign="left"
              fontWeight="normal"
              maxMenuItems={7}
              textAlloptions="All Epochs"
              onSelectAll={() => setSelectedAuctions(auctionOptions)}
              onSelectNone={() => setSelectedAuctions([])}
            />
          </SelectWrapper>
        )}
      </HeaderContainer>

      {isBidHistory ? (
        dotAggregated.chartData.length === 0 ? (
          <NoDataContainer>No bids found for this epoch</NoDataContainer>
        ) : (
          <DotChart
            chartData={dotAggregated.chartData}
            xDataKey="bucketIndex"
            yDataKey="price"
            highlightKey="isFinalBid"
            xTicks={dotAggregated.bucketIndices}
            xTickFormatter={(idx: number) =>
              dotAggregated.labelMap.get(idx) || ''
            }
            tooltipLabelFormatter={(idx: number) =>
              `Time: ${dotAggregated.labelMap.get(idx) || ''}`
            }
            tooltipValuesFormatter={(
              _value: any,
              _name: string,
              props: any
            ) => {
              const d = props.payload;
              const lines = [
                `Bids: ${d.count}`,
                `Total Amount: ${d.totalBidAmount.toFixed(2)} USDS`,
              ];
              if (d.count > 1) {
                lines.push(`Avg Price: ${d.price.toFixed(6)} USDS/TGLD`);
                lines.push(
                  `Price Range: ${d.minPrice.toFixed(6)} – ${d.maxPrice.toFixed(
                    6
                  )}`
                );
              } else {
                lines.push(`Price: ${d.price.toFixed(6)} USDS/TGLD`);
              }
              return lines.join('\n');
            }}
            xAxisTitle="Time"
            yAxisTitle="USDS/TGLD"
            yAxisDomain={dotYDomain}
            yAxisTicks={dotYTicks}
          />
        )
      ) : (
        <CustomBarChart
          chartData={barChartData}
          xDataKey="timestamp"
          yDataKey="value"
          xTickFormatter={(val: number) =>
            new Date(val * 1000).toLocaleDateString('en-GB', {
              month: 'short',
              day: 'numeric',
            })
          }
          yTickFormatter={chartConfig.yTickFormatter}
          tooltipLabelFormatter={(value: number) => {
            const found = barChartData.find((d) => d.timestamp === value);
            const year = found
              ? new Date(found.timestamp * 1000).getFullYear()
              : '';
            return (
              <>
                {found?.id && <div>Auction ID: {found.id}</div>}
                <div>
                  End Date: {found?.date} {year}
                </div>
              </>
            );
          }}
          tooltipValuesFormatter={chartConfig.tooltipValuesFormatter}
          xAxisTitle="Auction end date"
          yAxisTitle={chartConfig.yAxisTitle}
          yAxisDomain={barYDomain}
          yAxisTicks={barYTicks}
        />
      )}
    </PageContainer>
  );
};

const PageContainer = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const HeaderContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  gap: 15px 40px;
  align-items: center;
`;

const SelectWrapper = styled.div`
  width: 200px;
`;

const NoDataContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 350px;
  color: ${({ theme }) => theme.palette.brand};
  font-size: 16px;
`;
