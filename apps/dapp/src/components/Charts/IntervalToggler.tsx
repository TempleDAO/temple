import type { FC, Dispatch, SetStateAction, MouseEventHandler } from 'react';
import type {
  ChartSupportedTimeInterval,
  LabeledTimeIntervals,
} from 'utils/time-intervals';
import styled from 'styled-components';
import { DEFAULT_CHART_INTERVALS } from 'utils/time-intervals';

type IntervalTogglerProps = {
  selectedInterval: ChartSupportedTimeInterval;
  setSelectedInterval: Dispatch<SetStateAction<ChartSupportedTimeInterval>>;
  intervals?: LabeledTimeIntervals;
};

const IntervalToggler: FC<IntervalTogglerProps> = ({
  selectedInterval,
  setSelectedInterval,
  intervals = DEFAULT_CHART_INTERVALS,
}) => {
  return (
    <TogglerContainer>
      {intervals.map(({ label }) => (
        <Toggle
          key={label}
          onClick={() => setSelectedInterval(label)}
          selected={label === selectedInterval}
        >
          {label}
        </Toggle>
      ))}
    </TogglerContainer>
  );
};

export default IntervalToggler;

const TogglerContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 1.25rem;
  font-size: 0.7rem;
`;

type ToggleProps = {
  selected?: boolean;
  onClick: MouseEventHandler;
};

const Toggle = styled.span<ToggleProps>`
  display: inline-block;
  user-select: none;
  cursor: pointer;
  color: ${({ selected, theme }) =>
    selected ? theme.palette.brandLight : theme.palette.brand};
  &:hover {
    color: white;
  }
  font-size: 1rem;
  text-decoration: ${({ selected }) => (selected ? 'underline' : 'none')};
  font-weight: ${({ selected }) => (selected ? 'bold' : '')};
`;
