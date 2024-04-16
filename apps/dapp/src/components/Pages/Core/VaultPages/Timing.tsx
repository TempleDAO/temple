import styled from 'styled-components';
import { format, isDate } from 'date-fns';

import {
  Table as BaseTable,
  Head,
  Row,
  Body,
  Cell,
} from 'components/Table/Table';

import { useVaultContext } from 'components/Pages/Core/VaultContext';
import VaultContent from './VaultContent';
import { formatTemple } from 'components/Vault/utils';
import { ZERO } from 'utils/bigNumber';
import { Link } from 'react-router-dom';

const Timing = () => {
  const {
    vaultGroup,
    balances: { balances },
  } = useVaultContext();

  return (
    <VaultContent>
      <Header>Timing</Header>
      <TableWrapper>
        <Table $expand>
          <Head>
            <Row>
              <Cell $align="center" as="th">
                Sub-Vault
              </Cell>
              <Cell $align="center" as="th">
                Balance
              </Cell>
              <Cell $align="center" as="th">
                Claimable
              </Cell>
              <Cell $align="center" as="th">
                Claim
              </Cell>
            </Row>
          </Head>
          <StyledBody>
            {vaultGroup?.vaults.map((vault) => {
              const vaultGroupBalances = balances[vaultGroup.id];
              const vaultBalance = vaultGroupBalances[vault.id] || {};
              const unlockValue = isDate(vault.unlockDate)
                ? format(vault.unlockDate as Date, 'MMM do')
                : 'now';
              return (
                <Row key={vault.id}>
                  <Cell $align="center">
                    {vault.isActive ? `> ${vault.label} <` : vault.label}
                  </Cell>
                  <Cell $align="center">
                    {formatTemple(vaultBalance.balance)} $T
                  </Cell>
                  <Cell $align="center">{unlockValue}</Cell>
                  <Cell $align="center">
                    {vaultBalance.balance?.gt(ZERO) ? (
                      <Link
                        to={`/dapp/vaults/${vaultGroup!.id}/claim`}
                        state={{
                          earlyClaimSubvaultAddress: vault.id,
                          isClaimingEarly: unlockValue !== 'now',
                          earlyClaimAmount: vaultBalance.balance,
                        }}
                      >
                        {vaultBalance.balance?.gt(ZERO)
                          ? `Claim ${unlockValue !== 'now' ? 'Early' : ''}`
                          : ' - '}
                      </Link>
                    ) : (
                      ' - '
                    )}
                  </Cell>
                </Row>
              );
            })}
          </StyledBody>
        </Table>
      </TableWrapper>
      <Duration>{vaultGroup?.months} periods in this vault</Duration>
    </VaultContent>
  );
};

const COLOR_HEADER_SHADOW = '0px 4px 7.48px rgba(222, 92, 6, 0.5)';

const TableWrapper = styled.div`
  height: 18.1875rem; /* 291/16 */
`;

const Table = styled(BaseTable)`
  margin-bottom: 3.375rem; /* 54/16 */
`;

const StyledBody = styled(Body)`
  font-size: 1rem;
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
