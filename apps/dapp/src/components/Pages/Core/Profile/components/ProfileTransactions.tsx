import React from 'react';
import styled from 'styled-components';
import { format } from 'date-fns';

import Loader from 'components/Loader/Loader';
import { Button } from 'components/Button/Button';
import { Body, Cell, Head, Row, Table } from 'components/Table/Table';

import { useTransactionHistory } from 'hooks/use-transaction-history';

import { Container, Subheading } from '../styles';
import { fromAtto } from 'utils/bigNumber';
import { formatNumber } from 'utils/formatter';

export const ProfileTransactions = () => {
  const { transactions, isLoading, error } = useTransactionHistory();

  if (isLoading) {
    return (
      <Container>
        <Loader />
      </Container>
    );
  }
  if (error) {
    return (
      <Container>
        <Subheading>Error getting transactions</Subheading>
        <p>{error.message}</p>
      </Container>
    );
  }

  if (!transactions.length) {
    return (
      <>
        <Container>
          <Subheading>No transactions</Subheading>
          <Button isSmall as="a" href="/core/trade" label="Trade" />
        </Container>
      </>
    );
  }

  return (
    <>
      <Table $expand>
        <Head>
          <Row>
            <Cell as="th">Date</Cell>
            <Cell as="th">Interacted With</Cell>
            <Cell as="th">Gas</Cell>
            <Cell as="th">Tx Hash</Cell>
          </Row>
        </Head>
        <Body>
          {transactions.map((transaction) => {
            return (
              <Row key={transaction.id}>
                <Cell>{format(transaction.time, 'dd MMM yy')}</Cell>
                <Cell>
                  <LinkStyled
                    href={`https://etherscan.io/address/${transaction.to}`}
                  >
                    {transaction.toName ?? transaction.to}
                  </LinkStyled>
                </Cell>
                <Cell>{`${formatNumber(transaction.gasGwei)} Gwei`}</Cell>
                <Cell>
                  <LinkStyled
                    href={`https://etherscan.io/tx/${transaction.id}`}
                  >
                    {`${transaction.id.substring(0, 6)}`}
                  </LinkStyled>
                </Cell>
              </Row>
            );
          })}
        </Body>
      </Table>
    </>
  );
};

const LinkStyled = styled.a`
  color: unset;
  text-decoration: none;
`;
