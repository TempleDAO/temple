import { useEffect, useState } from 'react';
import styled, { useTheme } from 'styled-components';
import { format, subDays } from 'date-fns';
import LineChart from './LineChart';
import Loader from 'components/Loader/Loader';
import { formatNumberAbbreviated } from 'utils/formatter';
import expand from 'assets/icons/expand_more.svg?react';
import * as breakpoints from 'styles/breakpoints';

type XAxisTickFormatter = (timestamp: number) => string;

const tickFormatter: XAxisTickFormatter = (timestamp) =>
  format(new Date(timestamp), 'MMM dd');

type Metric = { timestamp: number; price: number };

enum Options {
  ValueOfHoldings = 'Value of Holdings',
  Option2 = 'Option 2',
  Option3 = 'Option3',
}

const pricesLast7Days = [
  { timestamp: subDays(new Date(), 6).getTime(), price: 1.13 },
  { timestamp: subDays(new Date(), 5).getTime(), price: 1.14 },
  { timestamp: subDays(new Date(), 4).getTime(), price: 1.13 },
  { timestamp: subDays(new Date(), 3).getTime(), price: 1.14 },
  { timestamp: subDays(new Date(), 2).getTime(), price: 1.16 },
  { timestamp: subDays(new Date(), 1).getTime(), price: 1.15 },
  { timestamp: new Date().getTime(), price: 1.17 },
];

export const Chart = () => {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const theme = useTheme();

  useEffect(() => {
    setMetrics(pricesLast7Days);
  }, []);

  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState(Options.ValueOfHoldings);

  const toggleDropDown = () => {
    setIsOpen(!isOpen);
  };

  const handleSelectedOption = (option: Options) => {
    setSelectedOption(option);
    setIsOpen(!isOpen);
  };

  const [filter, setFilter] = useState('1W');

  const filterOptions = ['1D', '1W', '1M', '1Y'];

  if (!metrics.length) return <Loader />;

  return (
    <PageContainer>
      <HeaderContainer>
        <Option onClick={toggleDropDown}>
          {selectedOption}
          <ExpandIcon />
          {isOpen && (
            <DropDownMenu>
              <DropDownItem
                onClick={() => handleSelectedOption(Options.ValueOfHoldings)}
              >
                Value of Holdings
              </DropDownItem>
              <DropDownItem
                onClick={() => handleSelectedOption(Options.Option2)}
              >
                Option 2
              </DropDownItem>
              <DropDownItem
                onClick={() => handleSelectedOption(Options.Option3)}
              >
                Option 3
              </DropDownItem>
            </DropDownMenu>
          )}
        </Option>
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
      <LineChart
        chartData={metrics.reverse()}
        xDataKey="timestamp"
        lines={[{ series: 'price', color: theme.palette.brandLight }]}
        xTickFormatter={tickFormatter}
        yTickFormatter={(val) =>
          `$${formatNumberAbbreviated(val).number.toFixed(2)}\u00A0M`
        }
        tooltipLabelFormatter={tickFormatter}
        yDomain={[1.12, 1.18]}
        tooltipValuesFormatter={(value) => [`$ ${value.toFixed(2)} M`, 'Value']}
      />
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

const Option = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  gap: 10px;
  padding: 5px 10px 5px 10px;
  justify-content: space-between;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  border-radius: 5px;
  font-size: 16px;
  line-height: 19px;
  color: ${({ theme }) => theme.palette.brandLight};

  ${breakpoints.phoneAndAbove(`
    width: 195px;
  `)}
`;

const ExpandIcon = styled(expand)`
  min-width: 24px;
  min-height: 24px;
`;

const DropDownMenu = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  position: absolute;
  background: ${({ theme }) => theme.palette.grayOpaque};
  box-shadow: ${({ theme }) => theme.palette.gradients.grey};
`;

const DropDownItem = styled.li`
  padding: 8px 16px;
  cursor: pointer;
  color: ${({ theme }) => theme.palette.brand};
  &:hover {
    background-color: ${({ theme }) => theme.palette.brandLight};
  }
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
