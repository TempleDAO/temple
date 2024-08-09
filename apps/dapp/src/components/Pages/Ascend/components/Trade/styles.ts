import styled from 'styled-components';

import { backgroundImage, buttonResets, flexCenter } from 'styles/mixins';
import arrowIcon from 'assets/icons/arrow-icon-no-background.svg';
import arrowUpIcon from 'assets/icons/arrow-icon-up.svg';
import filterIcon from 'assets/icons/filter-icon.svg';
import { theme } from 'styles/theme';

export const Wrapper = styled.div<{ verticalAlignment?: 'top' | 'center' }>`
  padding: 28px;
  display: flex;
  align-items: center;
  justify-content: ${({ verticalAlignment = 'center' }) => verticalAlignment};
  flex-direction: column;
  border-radius: 1rem;
  background: #1d1a1a;
`;

export const TradeHeader = styled.h3`
  margin: 0 0 1rem;
`;

export const LoadWrapper = styled.div`
  margin-right: 0.5rem;
  display: block;
`;

export const ReceivedValues = styled.div`
  font-size: 0.875rem;
  line-height: 1.125rem;
`;

export const SlippageButton = styled.button`
  ${buttonResets}

  border: 1px solid ${({ theme }) => theme.palette.brand};
  background: transparent;
  padding: 0.5rem;
  color: ${({ theme }) => theme.palette.light};
  font-weight: 700;
  margin-left: auto;
`;

export const SwapControls = styled.div`
  display: flex;
  margin: 1rem 0;
  flex-direction: row;
  width: 100%;
  align-items: center;
`;

export const ToggleButton = styled.button`
  ${buttonResets}

  ${backgroundImage(arrowIcon, {
    color: theme.palette.brand,
    size: '50%',
  })}

  &:hover {
    transform: rotate(180deg);
  }

  transition: all 150ms;
  width: 1.875rem;
  height: 1.875rem;
  border-radius: 50%;
  margin-top: calc(-0.2rem - 0.5625rem);
  margin-bottom: -0.5625rem;
  z-index: 50;
`;

export const FilterButton = styled.button`
  ${buttonResets}

  ${backgroundImage(filterIcon)}

  width: 1rem;
  height: 1rem;
`;

export const ArrowButtonUpDown = styled.button<{ clicked?: boolean }>`
  ${buttonResets}

  ${backgroundImage(arrowUpIcon)}

  transform: ${({ clicked }) => clicked && 'rotate(180deg)'};
  transition: all 150ms;
  width: 1rem;
  height: 1rem;
`;

export const SwapButton = styled.button`
  ${buttonResets}
  ${flexCenter}

  border-radius: 0.625rem;
  background-color: ${({ theme }) => theme.palette.brand};
  border: 1px solid ${({ theme }) => theme.palette.brand};
  font-weight: 700;
  color: ${({ theme }) => theme.palette.light};
  display: flex;
  padding: 1.25rem 0;
  width: 100%;
  text-transform: uppercase;

  transition: all ease-in 200ms;

  &:hover {
    background-color: ${({ theme }) => theme.palette.brand75};
    border: 1px solid ${({ theme }) => theme.palette.brand75};
  }

  &:disabled {
    background-color: transparent;
    border: 1px solid ${({ theme }) => theme.palette.brand50};
    color: ${({ theme }) => theme.palette.brand50};
    cursor: not-allowed;
  }
`;

export const ErrorMessage = styled.div`
  padding: 1rem;
  font-size: 0.875rem;
  line-height: 1rem;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  margin-top: 1rem;
`;
