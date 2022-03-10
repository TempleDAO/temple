import React from 'react';
import styled from 'styled-components';

import claimStar from './claim-star.svg';

export const Table = styled.table<{ $expand?: boolean }>`
  border-collapse: collapse;
  width: ${({ $expand }) => $expand ? '100%' : 'auto'};
`;

const TABLE_TEXT_COLOR = '#FFDEC9';

export const Head = styled.thead`
  ${({ theme }) => theme.typography.fonts.fontBody}
  font-weight: bold;
  font-size: 0.625rem;
  line-height: 0.9375rem;
  color: ${TABLE_TEXT_COLOR};
  text-transform: uppercase;
  text-align: left;
`;

const GRADIENT_EVEN_ROW_BACKGROUND =
    'linear-gradient(90deg, rgba(196, 196, 196, 0) 0.49%, rgba(89, 89, 89, 0.48) 50.04%, rgba(196, 196, 196, 0) 83.73%)';

export const Body = styled.tbody`
  ${({ theme }) => theme.typography.fonts.fontBody}
  font-weight: bold;
  font-size: 0.8125rem;
  line-height: 1.25rem;
  color: ${TABLE_TEXT_COLOR};

  tr {
    &:nth-child(even) {
      background: ${GRADIENT_EVEN_ROW_BACKGROUND};
    }
  }
`;

export const Row = styled.tr`
  border-bottom: 0.125rem solid #95613F;
`;

type Alignment = 'left' | 'center' | 'right';
type Icon = 'claim' | 'bread';

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

  background-image: ${({ $icon }) => $icon ? `url(${getIcon($icon)})` : 'none'};
  background-repeat: no-repeat;
  background-position: center center;

  &:first-of-type {
    padding: 0.5625rem 1.5rem 0.5625rem 0.25rem;
  }

  &:last-of-type {
    padding: 0.5625rem 0.25rem  0.5625rem 0;
  }
`;

// TODO
export const Test = () => (
  <Table $expand>
    <Head>
      <Row>
        <Cell as="th">
          Position
        </Cell>
        <Cell $align="center" as="th">
          Start/End
        </Cell>
        <Cell $align="center" as="th">
          Amount
        </Cell>
        <Cell $align="center" as="th">
          Claimable
        </Cell>
      </Row>
    </Head>
    <Body>
      <Row>
        <Cell>
          68 Days
        </Cell>
        <Cell $align="center">
          Jan 01, 2022 -<br />
          June 01,2022
        </Cell>
        <Cell $align="center">
          T$ 301,452
        </Cell>
        <Cell $align="center" $icon="claim">
          T$ 32,150
        </Cell>
      </Row>
      <Row>
        <Cell>
          38 Days
        </Cell>
        <Cell $align="center">
          Feb 01, 2022 -<br />
          July 01,2022
        </Cell>
        <Cell $align="center">
          T$ 33,198
        </Cell>
        <Cell $align="center">
          NO
        </Cell>
      </Row>
      <Row>
        <Cell>
          68 Days
        </Cell>
        <Cell $align="center">
          Jan 01, 2022 -<br />
          June 01,2022
        </Cell>
        <Cell $align="center">
          T$ 301,452
        </Cell>
        <Cell $align="center">
          NO
        </Cell>
      </Row>
      <Row>
        <Cell>
          68 Days
        </Cell>
        <Cell $align="center">
          Jan 01, 2022 -<br />
          June 01,2022
        </Cell>
        <Cell $align="center">
          T$ 301,452
        </Cell>
        <Cell $align="center">
          T$ 32,150
        </Cell>
      </Row>
    </Body>
  </Table>
);

export default Table;