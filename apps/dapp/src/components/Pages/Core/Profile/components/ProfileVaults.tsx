import React from 'react';
import { format, isDate } from 'date-fns';
import styled from 'styled-components';

import { Body, Cell, Head, Row, Table } from 'components/Table/Table';
import type { VaultGroup } from 'components/Vault/types';
import Loader from 'components/Loader/Loader';
import { Button } from 'components/Button/Button';
import { VaultGroupBalances } from 'hooks/core/use-vault-group-token-balance';

import { Container, Subheading } from '../styles';
import { formatTemple } from 'components/Vault/utils';

interface IProps {
  isLoading?: boolean;
  vaultGroups: VaultGroup[];
  vaultGroupBalances: { [groupId: string]: VaultGroupBalances };
}

export const ProfileVaults: React.FC<IProps> = ({
  isLoading,
  vaultGroups,
  vaultGroupBalances,
}) => {
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
        <Button isSmall as="a" label="Enter a vault" href="/dapp/vaults" />
      </Container>
    );
  }

  return (
    <Container>
      <Subheading>Vaults</Subheading>
      {vaultGroups.map((vaultGroup) => {
        return (
          <div key={vaultGroup.id}>
            <VaultHeader>{vaultGroup.id}</VaultHeader>
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
                  const vaultGroupBalance = vaultGroupBalances[vaultGroup.id];
                  const unlockValue = isDate(vault.unlockDate)
                    ? format(vault.unlockDate as Date, 'MMM do')
                    : 'now';
                  const vaultBalance = vaultGroupBalance[vault.id] || {};
                  return (
                    <Row key={vault.id}>
                      <Cell>{vault.label}</Cell>
                      <Cell>{formatTemple(vaultBalance.staked)} $T</Cell>
                      <Cell>{formatTemple(vaultBalance.balance)} $T</Cell>
                      <Cell>{unlockValue}</Cell>
                    </Row>
                  );
                })}
              </Body>
            </Table>
          </div>
        );
      })}
    </Container>
  );
};

const VaultHeader = styled.h4`
  font-size: 1.25rem;
  margin: 0 0 1rem;
`;
