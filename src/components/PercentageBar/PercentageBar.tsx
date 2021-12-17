import React from 'react';
import styled from 'styled-components';
import { theme } from 'styles/theme';
import { formatNumber } from 'utils/formatter';

type AppColors = keyof typeof theme.palette;

interface PercentageBarProps {
  total: number;
  processed: number;
}

export const PercentageBar = ({ total, processed }: PercentageBarProps) => {
  const getItemPercentage = (value: number) => {
    return formatNumber((value * 100) / total);
  };

  return (
    <>
      <Bar>
        <BarItem value={getItemPercentage(processed)} color={'brand'} />
      </Bar>
      <Legend>
        <LegendItem>
          <LegendItemMarker color={'brand'} />
          <p>&nbsp;- AVAILABLE TO CLAIM</p>
        </LegendItem>
        <LegendItem>
          <LegendItemMarker color={'brand25'} />
          <p>&nbsp;- NOT PROCESSED</p>
        </LegendItem>
      </Legend>
    </>
  );
};

const Bar = styled.div`
  position: relative;
  height: 2rem;
  width: 100%;
  border-radius: 1rem;
  background-color: ${(props) => props.theme.palette.brand25};
  overflow: hidden;
`;

interface BarItemProps {
  value: number;
  color: AppColors;
}

const BarItem = styled.div<BarItemProps>`
  ${(props) => props.theme.typography.meta};
  position: absolute;
  top: 0;
  height: 2rem;
  width: ${(props) => props.value}%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${(props) => props.theme.palette.dark};
  border-radius: 1rem;
  background-color: ${(props) => props.theme.palette[props.color]};

  & + &:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    z-index: ${(props) => props.theme.zIndexes.below};
    transform: translateX(-50%);
    height: 100%;
    width: 100%;
    background-color: ${(props) => props.theme.palette[props.color]};
  }
`;

const Legend = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-around;
  flex-wrap: wrap;
`;
const LegendItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-around;
  flex-wrap: wrap;
`;

const LegendItemMarker = styled.div<Pick<BarItemProps, 'color'>>`
  border-radius: 1rem;
  width: 4rem;
  height: 1rem;
  border: 1px solid ${(props) => props.theme.palette.dark};
  background-color: ${(props) => props.theme.palette[props.color]};
`;

export default PercentageBar;
