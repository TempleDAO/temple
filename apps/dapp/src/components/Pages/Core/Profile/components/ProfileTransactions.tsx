import React from 'react';
import styled from 'styled-components';
import { format } from 'date-fns';

import Loader from 'components/Loader/Loader';
import { Button } from 'components/Button/Button';
import { Body, Cell, Head, Row, Table } from 'components/Table/Table';

import { useTransactionHistory } from 'hooks/use-transaction-history';

import { Container, Subheading, CenterContainer } from '../styles';
import { formatNumber } from 'utils/formatter';

export const ProfileTransactions = () => {
  const { transactions, isLoading, error } = useTransactionHistory();
  const header = <Subheading>Transactions</Subheading>;

  if (isLoading) {
    return (
      <Container>
        {header}
        <Loader />
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        {header}
        <p>{error.message}</p>
      </Container>
    );
  }

  if (!transactions.length) {
    return (
      <>
        <Container>
          {header}
          <CenterContainer>
            <Subheading textAlign="center">No transactions</Subheading>
            <Button isSmall as="a" href="/trade" label="Trade" />
          </CenterContainer>
        </Container>
      </>
    );
  }

  return (
    <>
      {header}
      <Table $expand>
        <Head>
          <Row>
            <Cell as="th">Date</Cell>
            <Cell as="th">Swapped</Cell>
            <Cell as="th">For</Cell>
            <Cell as="th">Contract</Cell>
            <Cell as="th">Tx Hash</Cell>
          </Row>
        </Head>
        <Body>
          {transactions.map((transaction) => {
            const isSwap = !!transaction.tokenSwapped;

            return (
              <Row key={transaction.id}>
                <Cell>{format(transaction.time, 'dd MMM yy')}</Cell>
                <Cell>
                  {isSwap &&
                    `${formatNumber(transaction.swappedAmount)} $${
                      transaction.tokenSwapped
                    }`}
                </Cell>
                <Cell>
                  {isSwap &&
                    `${formatNumber(transaction.receivedAmount)} $${
                      transaction.tokenSwappedFor
                    }`}
                </Cell>
                <Cell>
                  <LinkStyled
                    href={`https://etherscan.io/address/${transaction.to}`}
                  >
                    {transaction.toName ?? transaction.to}
                  </LinkStyled>
                </Cell>
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
