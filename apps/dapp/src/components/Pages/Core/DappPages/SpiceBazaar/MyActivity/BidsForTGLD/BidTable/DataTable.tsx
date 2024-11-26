import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Transaction } from './Table';
import { Button } from 'components/Button/Button';
import checkbox from 'assets/icons/checkbox-square.svg?react';
import { Popover } from 'components/Pages/Core/DappPages/SpiceBazaar/components/Popover';
import { BidDai } from '../BidDai';

enum TableHeaders {
  EpochId = 'EPOCH\nID',
  AuctionEndDateTime = 'Auction End\nDate/Time',
  BidAmount = 'Bid Amount',
  ClaimableTokens = 'Claimable TOKENS',
  Unit = 'Unit',
  UnitPrice = 'Unit Price (DAI)',
  Claim = 'Claim',
  Increase = '',
}

type TableProps = {
  transactions: Transaction[];
  loading: boolean;
  refetch?: () => void;
  dataRefetching?: boolean;
};

export const DataTable: React.FC<TableProps> = ({
  transactions,
  loading,
  refetch,
  dataRefetching,
}) => {
  const [modal, setModal] = useState<'closed' | 'bidDai'>('closed');

  const tableHeaders = [
    { name: TableHeaders.EpochId },
    { name: TableHeaders.AuctionEndDateTime },
    { name: TableHeaders.BidAmount },
    { name: TableHeaders.ClaimableTokens },
    { name: TableHeaders.Unit },
    { name: TableHeaders.UnitPrice },
    { name: TableHeaders.Claim },
    { name: TableHeaders.Increase },
  ];

  const [filter, setFilter] = useState('Last 5 Shown');
  const [filteredTransactions, setFilteredTransactions] =
    useState<Transaction[]>(transactions);

  const navigate = useNavigate();

  const filterOptions = ['Last 5 Shown', 'Show All'];

  // State to track the selected (checked) checkbox
  const [selectedClaim, setSelectedClaim] = useState<number | null>(null);

  // Function to handle checkbox change
  const handleCheckboxChange = (epochId: number) => {
    setSelectedClaim(epochId === selectedClaim ? null : epochId); // Toggle between checked and unchecked
  };

  return (
    <>
      <PageContainer>
        <Header>
          <Title>BID for TGLD History</Title>
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
        <TableData>
          <thead>
            <HeaderRow>
              {tableHeaders.map((h) => (
                <TableHeader key={h.name} name={h.name}>
                  {h.name === TableHeaders.Claim ? (
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
            ) : transactions.length === 0 ? (
              <DataRow>
                <DataCell colSpan={6}>No data available</DataCell>
              </DataRow>
            ) : (
              transactions.map((transaction) => (
                <DataRow key={transaction.epochId}>
                  <DataCell>{transaction.epochId}</DataCell>
                  <DataCell>{transaction.auctionEndDateTime}</DataCell>
                  <DataCell>{transaction.bidAmount} DAO</DataCell>
                  <DataCell>{transaction.claimableTokens}</DataCell>
                  <DataCell>{transaction.unit}</DataCell>
                  <DataCell>{transaction.unitPrice}</DataCell>
                  <DataCell>
                    <input
                      type="checkbox"
                      checked={selectedClaim === transaction.epochId}
                      onChange={() => handleCheckboxChange(transaction.epochId)}
                    />
                  </DataCell>
                  <DataCell>{transaction.claim}</DataCell>
                  <DataCell>
                    <TradeButton
                      onClick={() => setModal('bidDai')}
                      style={{ whiteSpace: 'nowrap', margin: 0 }}
                    >
                      Increase Bid
                    </TradeButton>
                  </DataCell>
                </DataRow>
              ))
            )}
          </tbody>
        </TableData>
      </PageContainer>
      <Popover
        isOpen={modal != 'closed'}
        onClose={() => setModal('closed')}
        closeOnClickOutside
        showCloseButton
      >
        <BidDai />
      </Popover>
    </>
  );
};

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 40px 0px 24px 0px;
  gap: 20px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Title = styled.h3`
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 24px;
  line-height: 44px;
  font-weight: 400;
  margin: 0;
`;

const FilterContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: 20px;
`;

const FilterButton = styled.button<{ selected: boolean }>`
  background: none;
  color: ${({ selected, theme }) =>
    selected ? theme.palette.brandLight : theme.palette.brand};
  border: none;
  cursor: pointer;
`;

const TableData = styled.table`
  border-spacing: 10px
  width: 100%;
  border-collapse: collapse;
`;

const HeaderRow = styled.tr`
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
`;

const TableHeader = styled.th<{ name: string }>`
  font-size: 13px;
  font-weight: 700;
  line-height: 20px;
  text-align: left;
  padding-top: 5px;
  color: ${({ theme }) => theme.palette.brand};
  white-space: ${({ name }) =>
    name === TableHeaders.EpochId || name === TableHeaders.AuctionEndDateTime
      ? 'pre-wrap'
      : 'nowrap'};
`;

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

  &:first-child {
    padding-left: 16px;
  }
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

const CheckBox = styled(checkbox)``;

const ClaimHeader = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
`;
