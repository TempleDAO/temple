import React from 'react';
import styled from 'styled-components';

export const Table = styled.table`
  border-collapse: collapse;
  width: 400px;

  tr {
    border-bottom: 2px solid #95613F;

    > td, th {
      padding: 9px 1.5rem 9px 0;

      &:last-of-type {
        padding-right: 9px 0;
      }
    }
  }
`;

const TABLE_TEXT_COLOR = '#FFDEC9';

export const Head = styled.thead`
  ${({ theme }) => theme.typography.fonts.fontBody}
  font-weight: bold;
  font-size: 10px;
  line-height: 15px;
  color: ${TABLE_TEXT_COLOR};
  text-transform: uppercase;
  text-align: left;
`;

export const Body = styled.tbody`
  ${({ theme }) => theme.typography.fonts.fontBody}
  font-weight: bold;
  font-size: 13px;
  line-height: 20px;
  color: ${TABLE_TEXT_COLOR};
`;

export const Row = styled.tr`
  border-bottom: 2px solid #95613F;
`;

type Alignment = 'left' | 'center' | 'right';

export const Cell = styled.td<{ align?: Alignment }>`
  text-align: ${({ align = 'left '}) => align};
  padding: 9px 1.5rem 9px 0;

  &:last-of-type {
    padding: 9px 0;
  }
`;

export const Test = () => {
  return (
    <Table>
      <Head>
        <Row>
          <Cell as="th">
            Position
          </Cell>
          <Cell align="center" as="th">
            Start/End
          </Cell>
          <Cell align="center" as="th">
            Amount
          </Cell>
          <Cell align="center" as="th">
            Claimable
          </Cell>
        </Row>
      </Head>
      <Body>
        <Row>
          <Cell>
            68 Days
          </Cell>
          <Cell>
            Jan 01, 2022 -
            June 01,2022
          </Cell>
          <Cell>
            T$ 301,452
          </Cell>
          <Cell>
            T$ 32,150
          </Cell>
        </Row>
        <Row>
          <Cell>
            38 Days
          </Cell>
          <Cell>
            Feb 01, 2022 -
            July 01,2022
          </Cell>
          <Cell>
            T$ 33,198
          </Cell>
          <Cell>
            NO
          </Cell>
        </Row>
        <Row>
          <Cell>
            68 Days
          </Cell>
          <Cell>
            Jan 01, 2022 -
            June 01,2022
          </Cell>
          <Cell>
            T$ 301,452
          </Cell>
          <Cell>
            NO
          </Cell>
        </Row>
        <Row>
          <Cell>
            68 Days
          </Cell>
          <Cell>
            Jan 01, 2022 -
            June 01,2022
          </Cell>
          <Cell>
            T$ 301,452
          </Cell>
          <Cell>
            T$ 32,150
          </Cell>
        </Row>
      </Body>
    </Table>
  );
}

export default Table;