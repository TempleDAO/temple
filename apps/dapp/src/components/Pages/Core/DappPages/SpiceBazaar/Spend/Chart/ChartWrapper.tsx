import { useState, useMemo, useCallback } from 'react';
import styled from 'styled-components';
import {
  InputSelect as MultiSelect,
  Option,
} from '../../components/InputSelector';
import { InputSelect as SingleSelect } from 'components/InputSelect/InputSelect';
import * as breakpoints from 'styles/breakpoints';
import { SpiceFinalPriceChart } from './SpiceFinalPriceChart';
import { BidHistoryChart } from './BidHistoryChart';

// We'll create these components in the next steps
// import { TotalTGLDBidChart } from './TotalTGLDBidChart';

type ChartsProps = {
  auctionAddress: string;
  auctionTokenAddress?: string;
};

// Chart type options for the first dropdown
enum ChartType {
  BidHistory = 'bid-history',
  SpiceFinalPrice = 'spice-final-price',
  // TotalTGLDBid = 'total-tgld-bid',
}

export const Charts = ({
  auctionAddress,
  auctionTokenAddress,
}: ChartsProps) => {
  // First dropdown: Chart type selection
  const chartTypeOptions: Option[] = useMemo(
    () => [
      { label: 'Bid History', value: ChartType.BidHistory },
      { label: 'Spice Final Price', value: ChartType.SpiceFinalPrice },
      // { label: 'Total TGLD Bid', value: ChartType.TotalTGLDBid },
    ],
    []
  );

  const [selectedChartType, setSelectedChartType] = useState<Option>(
    chartTypeOptions[0] // Default to "Bid History"
  );

  // Second dropdown: Chart-specific filters (will be populated based on chart type)
  const [chartSpecificFilters, setChartSpecificFilters] = useState<Option[]>(
    []
  );

  // Store available filter options from each chart type
  const [spiceFinalPriceOptions, setSpiceFinalPriceOptions] = useState<
    Option[]
  >([]);
  const [bidHistoryOptions, setBidHistoryOptions] = useState<Option[]>([]);

  // Get options for the second dropdown based on selected chart type
  const getChartSpecificOptions = useCallback((): Option[] => {
    switch (selectedChartType.value) {
      case ChartType.BidHistory:
        // Return epoch options from the BidHistoryChart
        return bidHistoryOptions;
      case ChartType.SpiceFinalPrice:
        // Return auction date options from the SpiceFinalPriceChart
        return spiceFinalPriceOptions;
      // case ChartType.TotalTGLDBid:
      // TBD - will be defined later
      // return [];
      default:
        return [];
    }
  }, [selectedChartType.value, spiceFinalPriceOptions, bidHistoryOptions]);

  const chartSpecificOptions = useMemo(
    () => getChartSpecificOptions(),
    [getChartSpecificOptions]
  );

  // Handle chart type change (single select)
  const handleChartTypeChange = (selected: Option) => {
    if (selected) {
      setSelectedChartType(selected);
      setChartSpecificFilters([]); // Reset filters when chart type changes
    }
  };

  // Callback to receive filter options from SpiceFinalPriceChart
  const handleSpiceFinalPriceOptionsChange = useCallback(
    (options: Option[]) => {
      setSpiceFinalPriceOptions(options);
      // Auto-select all options by default if none are selected
      if (chartSpecificFilters.length === 0) {
        setChartSpecificFilters(options);
      }
    },
    [chartSpecificFilters.length]
  );

  // Callback to receive filter options from BidHistoryChart
  const handleBidHistoryOptionsChange = useCallback(
    (options: Option[]) => {
      setBidHistoryOptions(options);
      // Auto-select the most recent epoch by default if none are selected
      if (chartSpecificFilters.length === 0 && options.length > 0) {
        setChartSpecificFilters([options[options.length - 1]]);
      }
    },
    [chartSpecificFilters.length]
  );

  // Handle chart-specific filter change
  const handleChartSpecificFilterChange = (selected: Option[]) => {
    setChartSpecificFilters(selected);
  };

  // Render the appropriate chart based on selection
  const renderChart = () => {
    switch (selectedChartType.value) {
      case ChartType.BidHistory:
        return (
          <BidHistoryChart
            auctionTokenAddress={auctionTokenAddress}
            selectedFilters={chartSpecificFilters}
            onFilterOptionsChange={handleBidHistoryOptionsChange}
          />
        );
      case ChartType.SpiceFinalPrice:
        return (
          <SpiceFinalPriceChart
            auctionAddress={auctionAddress}
            selectedFilters={chartSpecificFilters}
            onFilterOptionsChange={handleSpiceFinalPriceOptionsChange}
          />
        );
      // case ChartType.TotalTGLDBid:
      //   return (
      //     <EmptyChartContainer>
      //       <EmptyChartText>Total TGLD Bid Chart - Coming Soon</EmptyChartText>
      //     </EmptyChartContainer>
      //     // Will be: <TotalTGLDBidChart auctionAddress={auctionAddress} selectedFilters={chartSpecificFilters} />
      //   );
      default:
        return null;
    }
  };

  return (
    <PageContainer>
      <HeaderContainer>
        <DropdownsContainer>
          {/* First Dropdown: Chart Type Selector (Single Select) */}
          <SingleSelect
            options={chartTypeOptions}
            defaultValue={selectedChartType}
            onChange={handleChartTypeChange}
            width="200px"
            fontSize="1rem"
            maxMenuItems={3}
          />

          {/* Second Dropdown: Chart-Specific Filters */}
          {chartSpecificOptions.length > 0 &&
            (selectedChartType.value === ChartType.BidHistory ? (
              // Single Select for Bid History (epoch selection)
              <SingleSelect
                options={chartSpecificOptions}
                value={
                  chartSpecificFilters[0] ||
                  chartSpecificOptions[chartSpecificOptions.length - 1]
                }
                onChange={(selected: Option) => {
                  setChartSpecificFilters([selected]);
                }}
                width="220px"
                fontSize="1rem"
                maxMenuItems={7}
              />
            ) : (
              // Multi Select for other charts
              <MultiSelect
                options={chartSpecificOptions}
                value={chartSpecificFilters}
                onChange={handleChartSpecificFilterChange}
                width="180px"
                fontSize="1rem"
                maxMenuItems={7}
                textAlloptions="All Auctions"
              />
            ))}
        </DropdownsContainer>
      </HeaderContainer>

      {/* Render the selected chart */}
      <ChartContentContainer>{renderChart()}</ChartContentContainer>
    </PageContainer>
  );
};

// Styled Components (matching existing patterns)
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
    justify-content: space-between;
  `)}
`;

const DropdownsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;

  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
    gap: 15px;
  `)}
`;

const ChartContentContainer = styled.div`
  width: 100%;
  min-height: 400px;
`;

const EmptyChartContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 350px;
  border: 1px dashed ${({ theme }) => theme.palette.brand};
  border-radius: 10px;
  background: ${({ theme }) => theme.palette.black};
`;

const EmptyChartText = styled.div`
  color: ${({ theme }) => theme.palette.brand};
  font-size: 16px;
  line-height: 19px;
`;
