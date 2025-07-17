import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import CustomBarChart from './BarChart';
import Loader from 'components/Loader/Loader';
import { formatNumberAbbreviated } from 'utils/formatter';
import {
  InputSelect as MultiInputSelect,
  Option,
} from '../../components/InputSelector';
import { InputSelect as SingleInputSelect } from 'components/InputSelect/InputSelect';
import * as breakpoints from 'styles/breakpoints';
import {
  useStableGoldAuctionMetrics,
  MetricType,
} from '../hooks/use-stableGold-auction-metrics';
import { getYAxisDomainAndTicks } from 'components/Pages/Core/DappPages/SpiceBazaar/components/GetYAxisDomainAndTicks';

// Metric options for the dropdown
const metricOptions: { value: MetricType; label: string }[] = [
  { value: 'tgldFinalPrice', label: 'TGLD Final Price' },
  { value: 'totalUsdsBid', label: 'Total USDS Bid' },
  { value: 'tgldInCirculation', label: 'TGLD in Circulation' },
];

export const Chart = () => {
  const { data: metrics, loading } = useStableGoldAuctionMetrics();

  // State for selected metric type
  const [selectedMetric, setSelectedMetric] =
    useState<MetricType>('tgldFinalPrice');

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

  const handleAuctionChange = (selected: Option[]) => {
    setSelectedAuctions(selected);
  };

  const handleMetricChange = (selected: {
    value: MetricType;
    label: string;
  }) => {
    setSelectedMetric(selected.value);
  };

  const chartData = useMemo(() => {
    if (loading || !metrics?.length) return [];

    const data = metrics
      .filter((d) => selectedAuctions.some((option) => option.label === d.date))
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((d) => ({
        ...d,
        value: d[selectedMetric], // Dynamic value based on selected metric
      }));

    return data;
  }, [metrics, selectedAuctions, selectedMetric, loading]);

  const values = useMemo(() => chartData.map((d) => d.value), [chartData]);
  const { yDomain, yTicks } = getYAxisDomainAndTicks(values);

  // Dynamic chart configuration based on selected metric
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

  if (loading || !metrics?.length) return <Loader />;

  return (
    <PageContainer>
      <HeaderContainer>
        {/* Metrics Dropdown */}
        <SingleInputSelect
          options={metricOptions}
          defaultValue={metricOptions.find(
            (option) => option.value === selectedMetric
          )}
          onChange={handleMetricChange}
          width="280px"
          fontSize="1rem"
          maxMenuItems={7}
          isSearchable={false}
        />

        {/* Epochs Dropdown */}
        <MultiInputSelect
          options={auctionOptions}
          value={selectedAuctions}
          onChange={handleAuctionChange}
          width="200px"
          fontSize="1rem"
          maxMenuItems={7}
          textAlloptions="All Epochs"
        />
      </HeaderContainer>
      <CustomBarChart
        chartData={chartData}
        xDataKey="date"
        yDataKey="value"
        xTickFormatter={(val: any) => val}
        yTickFormatter={chartConfig.yTickFormatter}
        tooltipLabelFormatter={(value: string) => {
          const found = chartData.find((d) => d.date === value);
          return found?.id ? `Auction ID: ${found.id}` : value;
        }}
        tooltipValuesFormatter={chartConfig.tooltipValuesFormatter}
        xAxisTitle="Auction end date"
        yAxisTitle={chartConfig.yAxisTitle}
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
