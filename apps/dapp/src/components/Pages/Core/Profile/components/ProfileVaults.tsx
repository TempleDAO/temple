import React from 'react';
import { format } from 'date-fns';

import { TICKER_SYMBOL } from 'enums/ticker-symbol';

import { Body, Cell, Head, Row, Table } from 'components/Table/Table';
import type { VaultGroup } from 'components/Vault/types';
import Loader from 'components/Loader/Loader';
import { Button } from 'components/Button/Button';

import { Container, Subheading } from '../styles';

interface IProps {
  isLoading?: boolean;
  vaultGroups: VaultGroup[];
}

export const ProfileVaults: React.FC<IProps> = ({ isLoading, vaultGroups }) => {
  if (isLoading) {
    <Container>
      <Loader />
    </Container>;
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
        return (
          <div key={vaultGroup.id}>
            <Subheading>{`${vaultGroup.id}`}</Subheading>
            <Table $expand>
              <Head>
                <Row>
                  <Cell as="th">Start date</Cell>
                  <Cell as="th">Entry Date</Cell>
                  <Cell as="th">{TICKER_SYMBOL.TEMPLE_TOKEN} amount</Cell>
                </Row>
              </Head>
              <Body>
                {vaultGroup.vaults.flatMap((vault) => {
                  return vault.entries.map((entry) => {
                    const entryDate = entry.entryDate ?? new Date();
                    return (
                      <Row key={`${vault.id}${entry.id}`}>
                        <Cell>{format(vault.startDate, 'dd MMM yy')}</Cell>
                        <Cell>{format(entryDate, 'dd MMM yy')}</Cell>
                        <Cell>{entry.amount}</Cell>
                      </Row>
                    );
                  });
                })}
              </Body>
            </Table>
          </div>
        );
      })}
    </>
  );
};
