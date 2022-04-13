import styled from 'styled-components';
import {
  formatDistance,
  format,
  differenceInSeconds,
  addSeconds,
} from 'date-fns';

import {
  Table as BaseTable,
  Head,
  Row,
  Body,
  Cell,
} from 'components/Table/Table';

import { SECONDS_IN_MONTH } from 'components/Vault/desktop-parts/utils';
import { Vault } from 'components/Vault/types';

import { pixelsToRems } from 'styles/mixins';
import useVaultContext from './useVaultContext';
import { Duration, Wrapper } from './styles';

const Timing = () => {
  const vault = useVaultContext();
  return (
    <Wrapper>
      <Header>Timing</Header>
      <TableWrapper>
        <Table $expand>
          <Head>
            <Row>
              <Cell as="th">Entry Date</Cell>
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
                  {entry.entryDate
                    ? format(entry.entryDate, 'MMM d, yyyy')
                    : ''}
                </Cell>
                <Cell $align="center">$T {entry.amount}</Cell>
                <Cell $align="center">
                  {getFormattedEntryCycle(entry.currentCycle)}
                </Cell>
                <Cell
                  $icon={entry.inZone ? 'claim' : undefined}
                  $align="center"
                >
                  {entry.inZone ? 'YES' : getVaultClaimableFormatted(vault)}
                </Cell>
              </Row>
            ))}
          </Body>
        </Table>
      </TableWrapper>
      <Duration>{vault.months} Months</Duration>
    </Wrapper>
  );
};

const getVaultClaimableFormatted = (vault: Vault) => {
  const currentCycle = (vault.currentCycle || 0) + 1;
  const endOfCurrentCycle = SECONDS_IN_MONTH * vault.months * currentCycle;
  const vaultEndDate = addSeconds(vault.startDate!, endOfCurrentCycle);
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

export default Timing;
