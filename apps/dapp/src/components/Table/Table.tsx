import React from 'react';
import styled from 'styled-components';

import { backgroundImage } from 'styles/mixins';

import claimStar from 'assets/icons/claim-star.svg';

export const Table = styled.table<{ $expand?: boolean }>`
  border-collapse: collapse;
  width: ${({ $expand }) => ($expand ? '100%' : 'auto')};
`;

export const Head = styled.thead`
  ${({ theme }) => theme.typography.fonts.fontBody}
  color: ${({ theme }) => theme.palette.brandLight};
  font-weight: bold;
  font-size: 0.625rem;
  line-height: 0.9375rem;
  text-transform: uppercase;
  text-align: left;
`;

const GRADIENT_EVEN_ROW_BACKGROUND =
  'linear-gradient(90deg, rgba(196, 196, 196, 0) 0.49%, rgba(89, 89, 89, 0.48) 50.04%, rgba(196, 196, 196, 0) 83.73%)';

export const Body = styled.tbody`
  ${({ theme }) => theme.typography.fonts.fontBody}
  color: ${({ theme }) => theme.palette.brandLight};
  font-weight: bold;
  font-size: 0.8125rem;
  line-height: 1.25rem;

  tr {
    &:nth-child(even) {
      background: ${GRADIENT_EVEN_ROW_BACKGROUND};
    }
  }
`;

export const Row = styled.tr`
  border-bottom: 0.125rem solid ${({ theme }) => theme.palette.brandDark};
`;

type Alignment = 'left' | 'center' | 'right';
type Icon = 'claim';

interface CellProps {
  $align?: Alignment;
  $icon?: Icon;
}

const getIcon = (icon: Icon) => {
  switch (icon) {
    case 'claim':
      return claimStar;
  }

  throw new Error('Programming Error: Invalid Icon');
};

export const Cell = styled.td<CellProps>`
  text-align: ${({ $align = 'left' }) => $align};
  padding: 0.5625rem 1.5rem 0.5625rem 0;

  ${({ $icon }) =>
    $icon ? backgroundImage(getIcon($icon), { size: 'auto' }) : ''}

  &:first-of-type {
    padding: 0.5625rem 1.5rem 0.5625rem 0.25rem;
  }

  &:last-of-type {
    padding: 0.5625rem 0.25rem 0.5625rem 0;
  }
`;
