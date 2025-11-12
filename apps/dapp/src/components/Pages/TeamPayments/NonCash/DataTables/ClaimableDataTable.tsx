import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Button } from 'components/Button/Button';
import * as breakpoints from 'styles/breakpoints';
import { ScrollBar } from 'components/Pages/Core/DappPages/SpiceBazaar/components/CustomScrollBar';
import DownArrow from 'assets/icons/down-arrow.svg?react';

export type Transaction = {
  id: string;
  grantStartDate: string;
  grantEndDate: string;
  cliff: string;
  vestedAmount: number;
  claimableAmount: number;
  action: string;
};

type TableHeader = { name: string };

type TableProps = {
  tableHeaders: TableHeader[];
  transactions: Transaction[];
  loading: boolean;
  title: string;
  refetch?: () => void;
  dataRefetching?: boolean;
  claimTgld: (transactionId: string) => Promise<void>;
};

export const DataTable: React.FC<TableProps> = ({
  tableHeaders,
  transactions,
  loading,
  title,
  refetch,
  claimTgld,
}) => {
  const [filter, setFilter] = useState('Last 5 Shown');
  const [filteredTransactions, setFilteredTransactions] =
    useState<Transaction[]>(transactions);
  const filterOptions = ['Last 5 Shown', 'Show All'];

  useEffect(() => {
    const sortedTransactions = [...transactions].sort((a, b) => {
      // Sort by grant start date (most recent first)
      const dateA = new Date(a.grantStartDate).getTime();
      const dateB = new Date(b.grantStartDate).getTime();
      return dateB - dateA;
    });

    if (filter === 'Last 5 Shown') {
      setFilteredTransactions(sortedTransactions.slice(0, 5));
    } else {
      setFilteredTransactions(sortedTransactions);
    }
  }, [filter, transactions]);

  return (
    <>
      <PageContainer>
        <Header>
          <HeaderLeft>
            <Title>{title}</Title>
          </HeaderLeft>
          <FilterContainer>
            {filterOptions.map((option) => (
              <FilterButton
                key={option}
                onClick={() => setFilter(option)}
                selected={filter === option}
              >
                {option}
              </FilterButton>
            ))}
          </FilterContainer>
        </Header>
        <ScrollBar autoHide={false}>
          <TableData>
            <thead>
              <HeaderRow>
                {tableHeaders.map((h) => (
                  <TableHeader key={h.name} name={h.name}>
                    {h.name === 'Grant Start Date' ||
                    h.name === 'Grant End Date' ? (
                      <TableHeaderWithIcon>
                        {h.name}
                        <DownArrowIcon />
                      </TableHeaderWithIcon>
                    ) : (
                      <>{h.name}</>
                    )}
                  </TableHeader>
                ))}
              </HeaderRow>
            </thead>
            <tbody>
              {loading ? (
                <DataRow>
                  <DataCell colSpan={6}>Loading...</DataCell>
                </DataRow>
              ) : filteredTransactions.length === 0 ? (
                <DataRow>
                  <DataCell colSpan={6}>No data available</DataCell>
                </DataRow>
              ) : (
                filteredTransactions.map((transaction) => {
                  const shortenedId =
                    transaction.id.length > 16
                      ? `${transaction.id.slice(0, 8)}...${transaction.id.slice(
                          -6
                        )}`
                      : transaction.id;

                  return (
                    <DataRow key={transaction.id}>
                      <DataCell>{shortenedId}</DataCell>
                      <DataCell>{transaction.grantStartDate}</DataCell>
                      <DataCell>{transaction.grantEndDate}</DataCell>
                      <DataCell>{transaction.cliff}</DataCell>
                      <DataCell>{transaction.vestedAmount}</DataCell>
                      <DataCell>{transaction.claimableAmount}</DataCell>
                      <DataCell>
                        <ButtonContainer>
                          {transaction.action === 'Claim' && (
                            <TradeButton
                              style={{ whiteSpace: 'nowrap', margin: 0 }}
                              onClick={async () => {
                                await claimTgld(transaction.id);
                              }}
                            >
                              Claim
                            </TradeButton>
                          )}
                        </ButtonContainer>
                      </DataCell>
                    </DataRow>
                  );
                })
              )}
            </tbody>
          </TableData>
        </ScrollBar>
      </PageContainer>
    </>
  );
};

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 10px;

  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
    justify-content: space-between;
  `)}
`;

const HeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;

  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
    gap: 40px;
  `)}
`;

const Title = styled.h3`
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 24px;
  line-height: 44px;
  margin: 0;
`;

const FilterContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: 20px;
  padding-right: 16px;
`;

const FilterButton = styled.button<{ selected: boolean }>`
  font-size: 16px;
  line-height: 19px;
  background: none;
  color: ${({ selected, theme }) =>
    selected ? theme.palette.brandLight : theme.palette.brand};
  border: none;
  cursor: pointer;
`;

const TableData = styled.table`
  border-spacing: 10px;
  min-width: 800px;
  border-collapse: collapse;
  width: 100%;
`;

const HeaderRow = styled.tr`
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
`;

const TableHeader = styled.th<{ name: string }>`
  padding: 10px 25px;
  font-size: 13px;
  font-weight: 700;
  line-height: 20px;
  text-align: left;
  white-space: nowrap;
  color: ${({ theme }) => theme.palette.brand};
  position: sticky;
  top: 0;
  z-index: 1;

  &:first-child {
    padding: 10px 25px 10px 0px;
  }
`;

const TableHeaderWithIcon = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
`;

const DataRow = styled.tr`
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
`;

const DataCell = styled.td`
  font-size: 13px;
  font-weight: 700;
  line-height: 20px;
  text-align: left;
  white-space: nowrap;
  color: ${({ theme }) => theme.palette.brandLight};
  padding: 20px 25px;

  &:first-child {
    padding: 20px 25px 20px 0px;
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  width: 100%;
`;

const TradeButton = styled(Button)`
  padding: 10px 20px;
  width: ${(props) => props.width || '120px'};
  height: min-content;
  background: ${({ theme }) => theme.palette.gradients.dark};
  border: ${({ disabled, theme }) =>
    disabled ? 'none' : `1px solid ${theme.palette.brandDark}`};
  box-shadow: ${({ disabled }) =>
    disabled ? 'none' : '0px 0px 20px 0px rgba(222, 92, 6, 0.4)'};
  border-radius: 10px;
  font-weight: 700;
  font-size: 12px;
  line-height: 20px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const DownArrowIcon = styled(DownArrow)``;
