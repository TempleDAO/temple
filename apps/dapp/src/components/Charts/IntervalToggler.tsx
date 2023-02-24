import type { FC, Dispatch, SetStateAction, MouseEventHandler } from 'react';
import type { ChartSupportedTimeInterval } from 'utils/time-intervals';

import styled from 'styled-components';
import { DEFAULT_CHART_INTERVALS } from 'utils/time-intervals';

type IntervalTogglerProps = {
  selectedInterval: ChartSupportedTimeInterval;
  setSelectedInterval: Dispatch<SetStateAction<ChartSupportedTimeInterval>>;
};

const IntervalToggler: FC<IntervalTogglerProps> = ({ selectedInterval, setSelectedInterval }) => (
  <TogglerRow>
    <TogglerContainer>
      {DEFAULT_CHART_INTERVALS.map(({ label }) => (
        <Toggle key={label} onClick={() => setSelectedInterval(label)} selected={label === selectedInterval}>
          {label}
        </Toggle>
      ))}
    </TogglerContainer>
  </TogglerRow>
);

const TogglerRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: 1.25rem;
  width: 90%;
`;

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
  color: ${({ selected, theme }) => (selected ? theme.palette.brandLight : theme.palette.brand)};
  &:hover {
    color: white;
  }
  font-size: 1rem;
  font-weight: ${({ selected }) => (selected ? 'bold' : '')};
`;
