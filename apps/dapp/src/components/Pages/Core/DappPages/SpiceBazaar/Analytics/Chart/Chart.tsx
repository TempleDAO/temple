import { useState } from 'react';
import styled from 'styled-components';
import { format } from 'date-fns';
import * as breakpoints from 'styles/breakpoints';
import { InputSelect } from 'components/InputSelect/InputSelect';
import PriceChart from './PriceChart';
import TotalBidsChart from './TotalBidsChart';
import CirculatingSupplyChart from './CirculatingSupplyChart';
import StakedTempleChart from 'components/Pages/Core/DappPages/SpiceBazaar/Analytics/Chart/StakedTempleChart';
import EmissionAllocationStaked from 'components/Pages/Core/DappPages/SpiceBazaar/Analytics/Chart/EmissionAllocationStaked';
import TotalBidders from 'components/Pages/Core/DappPages/SpiceBazaar/Analytics/Chart/TotalBidders';
import TotalTGLDHoldersChart from 'components/Pages/Core/DappPages/SpiceBazaar/Analytics/Chart/TotalTGLDHoldersChart';
import EmissionAllocationEpochChart from 'components/Pages/Core/DappPages/SpiceBazaar/Analytics/Chart/EmissionAllocationEpoch';

type XAxisTickFormatter = (timestamp: number) => string;

export const tickFormatter: XAxisTickFormatter = (timestamp) =>
  format(new Date(timestamp), 'MMM dd');

export type Metric = { timestamp: number; price: number };

const metricOptions: { value: string; label: string }[] = [
  { label: 'Price', value: 'price' },
  { label: 'Total Bids', value: 'totalBids' },
  { label: 'Circulating Supply', value: 'circulatingSupply' },
  { label: 'Staked Temple', value: 'stakedTemple' },
  {
    label: 'Emission Allocation (Per Epoch)',
    value: 'emissionAllocation(PerEpoch)',
  },
  {
    label: 'Emission Allocation (Per staked TEMPLE)',
    value: 'emissionAllocation(PerstakedTEMPLE)',
  },
  { label: 'Total Bidders', value: 'totalBidders' },
  { label: 'Total TGLD Holders', value: 'totalTGLDHolders' },
];

export const Chart = () => {
  const [selectedMetric, setSelectedMetric] = useState('price');

  const selectMetric = (metric: string) => {
    setSelectedMetric(metric);
  };

  const [filter, setFilter] = useState('1W');
  const filterOptions = ['1D', '1W', '1M', '1Y'];

  return (
    <PageContainer>
      <HeaderContainer>
        <SelectMetricContainer>
          <InputSelect
            options={metricOptions}
            defaultValue={metricOptions.find((m) => m.value === selectedMetric)}
            onChange={(e) => selectMetric(e.value)}
            isSearchable={false}
            fontSize={'16px'}
            fontWeight={'400'}
          />
        </SelectMetricContainer>
        <FilterContainer>
          {filterOptions.map((option) => (
            <FilterButton
              key={option}
              onClick={() => setFilter(option)}
              selected={filter === option}
            >
              {option}
            </FilterButton>
          ))}
        </FilterContainer>
      </HeaderContainer>
      {selectedMetric === 'price' && <PriceChart />}
      {selectedMetric === 'totalBids' && <TotalBidsChart />}
      {selectedMetric === 'circulatingSupply' && <CirculatingSupplyChart />}
      {selectedMetric === 'stakedTemple' && <StakedTempleChart />}
      {selectedMetric === 'emissionAllocation(PerEpoch)' && (
        <EmissionAllocationEpochChart />
      )}
      {selectedMetric === 'emissionAllocation(PerstakedTEMPLE)' && (
        <EmissionAllocationStaked />
      )}
      {selectedMetric === 'totalBidders' && <TotalBidders />}
      {selectedMetric === 'totalTGLDHolders' && <TotalTGLDHoldersChart />}
    </PageContainer>
  );
};

const PageContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  flex-direction: column;
  gap: 10px;

  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
  `)}
`;

const SelectMetricContainer = styled.div`
  flex: 1;
  max-width: 370px;
`;

const FilterContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-self: flex-end;
  gap: 20px;
`;

const FilterButton = styled.button<{ selected: boolean }>`
  background: none;
  color: ${({ selected, theme }) =>
    selected ? theme.palette.brandLight : theme.palette.brand};
  text-decoration: ${({ selected }) => (selected ? 'underline' : 'none')};
  font-size: 16px;
  line-height: 19px;
  border: none;
  cursor: pointer;
`;
