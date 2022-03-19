import styled from 'styled-components';
import dateFormat from 'dateformat';
import { formatDistance } from 'date-fns';

import { Table as BaseTable, Head, Row, Body, Cell } from 'components/Table/Table';

import { VAULT_MONTH_MILLISECONDS } from '../../../../constants';
import useVaultContext from './useVaultContext';

const Timing = () => {
  const vault = useVaultContext();
  const vaultEndDate = getVaultEndDate(vault.startDate, vault.months);
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
                  {entry.entryDate ? dateFormat(entry.entryDate, 'mmm d, yyyy') : ''}
                </Cell>
                <Cell $align="center">
                  $T {entry.amount}
                </Cell>
                <Cell $align="center">
                  {getFormattedEntryCycle(entry.currentCycle)}
                </Cell>
                <Cell $icon={entry.inZone ? 'claim' : undefined} $align="center">
                  {entry.inZone ? 'YES' : getVaultClaimableFormatted(vaultEndDate)}
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

const getVaultEndDate = (vaultStart: Date, numMonths: number) => {
  return new Date(vaultStart.getTime() + (numMonths * VAULT_MONTH_MILLISECONDS));
};

const getVaultClaimableFormatted = (vaultEndDate: Date) => {
  return formatDistance(Date.now(), vaultEndDate);
};

const getFormattedEntryCycle = (cycleNumber = 0) => {
  cycleNumber = cycleNumber + 1;
  switch (cycleNumber) {
    case 1:
      return '1st';
    case 2:
      return '2nd';
    case 3:
      return '3rd';
    default:
      return `${cycleNumber}th`;
  }
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
  height: 18.1875rem; /* 291/16 */
`;

const Table = styled(BaseTable)`
  margin-bottom: 3.375rem; /* 54/16 */
`;

const Header = styled.h2`
  margin: 0 0 3.625rem; /* 58/16 */
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
  font-size: 0.9375rem; /* 15/16 */
  line-height: 1.1875rem;
  text-transform: uppercase;
  text-align: center;
  letter-spacing: 0.25em;
  color: ${({ theme }) => theme.palette.brandLight};
`;

export default Timing;
