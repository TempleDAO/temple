import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Button } from 'components/Button/Button';
import checkbox from 'assets/icons/box.svg?react';
import { Popover } from 'components/Pages/Core/DappPages/SpiceBazaar/components/Popover';
import { BidUSDS } from '../BidsForTGLD/BidUSDS';
import { BidTgld } from '../BidsForSpice/BidTgld';
import Checkbox from 'components/Pages/Core/DappPages/SpiceBazaar/components/CheckBox';
import * as breakpoints from 'styles/breakpoints';

export type Transaction = {
  epochId: number;
  auctionEndDateTime: string;
  bidAmount: number;
  claimableTokens: number | '-';
  unit: 'TGLD' | 'WSBI' | 'ENA';
  unitPrice: number | '-';
  claim: string;
  increase: string;
};

type TableHeader = { name: string };

type TableProps = {
  tableHeaders: TableHeader[];
  transactions: Transaction[];
  modal: 'bidDai' | 'bidTgld';
  loading: boolean;
  title: string;
  refetch?: () => void;
  dataRefetching?: boolean;
};

export const DataTable: React.FC<TableProps> = ({
  modal,
  tableHeaders,
  transactions,
  loading,
  title,
  refetch,
  dataRefetching,
}) => {
  const [modalState, setModalState] = useState<'closed' | 'bidDai' | 'bidTgld'>(
    'closed'
  );

  const [filter, setFilter] = useState('Last 5 Shown');
  const [filteredTransactions, setFilteredTransactions] =
    useState<Transaction[]>(transactions);
  const filterOptions = ['Last 5 Shown', 'Show All'];

  useEffect(() => {
    if (filter === 'Last 5 Shown') {
      setFilteredTransactions(transactions.slice(0, 5));
      // setFilteredTransactions(transactions.slice(-5)); - that's if the last transactions are in end of the array
    } else {
      setFilteredTransactions(transactions);
    }
  }, [filter, transactions]);

  const [isCheckboxChecked, setIsCheckboxChecked] = useState(false);
  const handleCheckboxToggle = (checked: boolean) => {
    setIsCheckboxChecked(checked);
  };

  return (
    <>
      <PageContainer>
        <Header>
          <Title>{title}</Title>
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
        <TableWrapper>
          <TableData>
            <thead>
              <HeaderRow>
                {tableHeaders.map((h) => (
                  <TableHeader key={h.name} name={h.name}>
                    {h.name === 'Claim' ? (
                      <ClaimHeader>
                        <CheckBox /> {h.name}
                      </ClaimHeader>
                    ) : (
                      h.name
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
                filteredTransactions.map((transaction) => (
                  <DataRow key={transaction.epochId}>
                    <DataCell>{transaction.epochId}</DataCell>
                    <DataCell>{transaction.auctionEndDateTime}</DataCell>
                    <DataCell>{transaction.bidAmount} DAO</DataCell>
                    <DataCell>{transaction.claimableTokens}</DataCell>
                    <DataCell>{transaction.unit}</DataCell>
                    <DataCell>{transaction.unitPrice}</DataCell>
                    <DataCell>
                      <Checkbox onToggle={handleCheckboxToggle} />
                    </DataCell>
                    <DataCell>{transaction.claim}</DataCell>
                    <DataCell>
                      <ButtonContainer>
                        <TradeButton
                          onClick={() => setModalState(modal)}
                          style={{ whiteSpace: 'nowrap', margin: 0 }}
                        >
                          Increase Bid
                        </TradeButton>
                      </ButtonContainer>
                    </DataCell>
                  </DataRow>
                ))
              )}
            </tbody>
          </TableData>
        </TableWrapper>
      </PageContainer>
      <Popover
        isOpen={modalState != 'closed'}
        onClose={() => setModalState('closed')}
        closeOnClickOutside
        showCloseButton
      >
        {modal === 'bidDai' && <BidUSDS />}
        {modal === 'bidTgld' && <BidTgld />}
      </Popover>
    </>
  );
};
const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 40px 0px 24px 0px;
  gap: 20px;

  ${breakpoints.phoneAndAbove(`
    gap: 10px;
  `)}
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-direction: column;
  gap: 10px;

  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
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

const TableWrapper = styled.div`
  overflow-x: scroll;
  padding-bottom: 20px;
  scrollbar-width: thin;
  scrollbar-color: #58321a #95613f;

  &::-webkit-scrollbar {
    height: 8px;
    background: transparent;
    border-radius: 8px;
  }

  &::-webkit-scrollbar-thumb {
    background: linear-gradient(to right, #58321a 20%, #95613f 84.5%);
    margin: 2px 82px 2px 2px;
  }

  &::-webkit-scrollbar-track {
    border: 1px solid #351f11;
    border-radius: 8px;
  }
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
  font-size: 13px;
  font-weight: 700;
  line-height: 20px;
  text-align: left;
  padding: 5px 0px 0px 0px;
  color: ${({ theme }) => theme.palette.brand};
  white-space: ${({ name }) => (name.includes('\n') ? 'pre-wrap' : 'nowrap')};
  position: sticky;
  top: 0;
  z-index: 1;
`;

const ClaimHeader = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
`;

const CheckBox = styled(checkbox)``;

const DataRow = styled.tr`
  padding-left: 16px;
`;

const DataCell = styled.td`
  font-size: 13px;
  font-weight: 700;
  line-height: 20px;
  text-align: left;
  padding: 20px 0px 20px 0px;
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
  color: ${({ theme }) => theme.palette.brandLight};

  ${breakpoints.phoneAndAbove(`
    &:last-child {
  text-align: right;
  }
  `)}
`;

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  width: 100%;
`;

const TradeButton = styled(Button)`
  padding: 10px 20px 10px 20px;
  width: ${(props) => props.width || 'min-content'};
  height: min-content;
  background: ${({ theme }) => theme.palette.gradients.dark};
  border: 1px solid ${({ theme }) => theme.palette.brandDark}; //if button is not active this is not used
  box-shadow: 0px 0px 20px rgba(222, 92, 6, 0.4); //if button is not active this is not used
  border-radius: 10px;
  font-weight: 700;
  font-size: 12px;
  line-height: 18px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.palette.brandLight};
`;
