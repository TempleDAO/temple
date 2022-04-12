import React from 'react';
import styled from 'styled-components';
import { format } from 'date-fns';

import { TICKER_SYMBOL } from 'enums/ticker-symbol';

import { Body, Cell, Head, Row, Table } from 'components/Table/Table';
import type { Vault } from 'components/Vault/types';
import Loader from 'components/Loader/Loader';
import { Button } from 'components/Button/Button';

import { Container, Subheading } from '../styles';

interface IProps {
  isLoading?: boolean;
  vaults: Vault[];
}

export const ProfileVaults: React.FC<IProps> = ({ isLoading, vaults }) => {
  if (isLoading) {
    <Container>
      <Loader />
    </Container>;
  }

  if (!vaults.length) {
    return (
      <Container>
        <Button isSmall as="a" label="Enter a vault" href="/core/dapp/vaults" />
      </Container>
    );
  }

  return (
    <>
      {vaults.map((vault) => {
        return (
          <div key={vault.id}>
            <Subheading>{`${vault.id}`}</Subheading>
            <Table $expand>
              <Head>
                <Row>
                  <Cell as="th">Start date</Cell>
                  <Cell as="th">Entry Date</Cell>
                  <Cell as="th">{TICKER_SYMBOL.TEMPLE_TOKEN} amount</Cell>
                </Row>
              </Head>
              <Body>
                {vault.entries.map((entry) => {
                  const entryDate = entry.entryDate ?? new Date();
                  return (
                    <Row key={`${vault.id}${entry.id}`}>
                      <Cell>{format(vault.startDate, 'dd MMM yy')}</Cell>
                      <Cell>{format(entryDate, 'dd MMM yy')}</Cell>
                      <Cell>{entry.amount}</Cell>
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
