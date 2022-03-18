import styled from 'styled-components';
import dateFormat from 'dateformat';

import { Table as BaseTable, Head, Row, Body, Cell } from 'components/Table/Table';

import useVaultContext from './useVaultContext';

const Timing = () => {
  const vault = useVaultContext();

  return (
    <Wrapper>
      <Header>Timing</Header>
      <TableWrapper>
        <Table $expand>
          <Head>
            <Row>
              <Cell as="th">
                Entry Date
              </Cell>
              <Cell $align="center" as="th">
                Amount
              </Cell>
              <Cell $align="center" as="th">
                Cycle
              </Cell>
              <Cell $align="center" as="th">
                Claimable
              </Cell>
            </Row>
          </Head>
          <Body>
            {(vault.entries || []).map((entry) => (
              <Row key={entry.id}>
                <Cell>
                  {entry.entryDate ? dateFormat(new Date(entry.entryDate), 'mmm d, yyyy') : ''}
                </Cell>
                <Cell $align="center">
                  $T {entry.amount}
                </Cell>
                <Cell $align="center">
                  {vault.currentCycle || 0}
                </Cell>
                <Cell $icon={entry.inZone ? 'claim' : undefined} $align="center">
                  {entry.inZone ? 'Yes' : 'No'}
                </Cell>
              </Row>
            ))}
          </Body>
        </Table>
      </TableWrapper>
      <Duration>
        {vault.months} Months
      </Duration>
    </Wrapper>
  );
};

const COLOR_HEADER_SHADOW = '0px 4px 7.48px rgba(222, 92, 6, 0.5)';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  padding: 1.25rem 1rem;
  width: 80%;
  margin: 0 auto;
  height: 100%;
`;

const TableWrapper = styled.div`
  height: 18.1875rem;
`;

const Table = styled(BaseTable)`
  margin-bottom: 3.375rem;
`;

const Header = styled.h2`
  margin: 0 0 3.625rem;
  font-size: 3rem;
  line-height: 3.5rem;
  text-align: center;
  text-shadow: ${COLOR_HEADER_SHADOW};
  color: ${({ theme }) => theme.palette.brandLight};
  font-weight: 300;
`;

const Duration = styled.span`
  display: flex;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9375rem;
  line-height: 1.1875rem;
  text-transform: uppercase;
  text-align: center;
  letter-spacing: 0.25em;
  color: ${({ theme }) => theme.palette.brandLight};
`;

export default Timing;
