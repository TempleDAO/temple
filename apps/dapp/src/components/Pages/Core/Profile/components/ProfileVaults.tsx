import React from 'react';
import { format, isDate } from 'date-fns';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';

import { Body, Cell, Head, Row, Table } from 'components/Table/Table';
import type { VaultGroup } from 'components/Vault/types';
import Loader from 'components/Loader/Loader';
import { Button } from 'components/Button/Button';
import { VaultGroupBalances } from 'hooks/core/use-vault-group-token-balance';

import { Container, Subheading } from '../styles';

interface IProps {
  isLoading?: boolean;
  vaultGroups: VaultGroup[];
  vaultGroupBalances: VaultGroupBalances;
}

export const ProfileVaults: React.FC<IProps> = ({ isLoading, vaultGroups, vaultGroupBalances }) => {
  if (isLoading) {
    return (
      <Container>
        <Loader />
      </Container>
    );
  }

  if (!vaultGroups.length) {
    return (
      <Container>
        <Button isSmall as="a" label="Enter a vault" href="/core/dapp/vaults" />
      </Container>
    );
  }

  return (
    <>
      {vaultGroups.map((vaultGroup) => {
        const balances = vaultGroupBalances[vaultGroup.id] || {};
        return (
          <div key={vaultGroup.id}>
            <Subheading>{vaultGroup.id}</Subheading>
            <Table $expand>
              <Head>
                <Row>
                  <Cell as="th">Sub-Vault</Cell>
                  <Cell as="th">Staked</Cell>
                  <Cell as="th">Balance</Cell>
                  <Cell as="th">Claimable</Cell>
                </Row>
              </Head>
              <Body>
                {vaultGroup.vaults.map((vault) => {
                  const unlockValue = isDate(vault.unlockDate) ? format(vault.unlockDate as Date, 'MMM do') : 'now';
                  const vaultBalance = balances[vault.id] || {};
                  // const balance = balances[vault.id]?.balance || 0;
                  // // TODO: THIS needs to be improved
                  return (
                    <Row key={vault.id}>
                      <Cell $align="center">{vault.label}</Cell>
                      <Cell $align="center">{vaultBalance.staked || 0} $T</Cell>
                      <Cell $align="center">{vaultBalance.balance || 0} $T</Cell>
                      <Cell $align="center">{unlockValue}</Cell>
                    </Row>
                  );
                })}
              </Body>
            </Table>
          </div>
        );
      })}
    </>
  );
};
