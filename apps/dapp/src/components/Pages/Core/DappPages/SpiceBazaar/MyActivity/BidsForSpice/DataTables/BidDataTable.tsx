import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Button } from 'components/Button/Button';
import { Popover } from 'components/Pages/Core/DappPages/SpiceBazaar/components/Popover';
import * as breakpoints from 'styles/breakpoints';
import { useSpiceBazaar } from 'providers/SpiceBazaarProvider';
import { BidUSDS, BidUSDSMode } from '../../../Earn/Auctions/BidUSDS';
import { formatNumberWithCommas } from 'utils/formatter';
import { ScrollBar } from 'components/Pages/Core/DappPages/SpiceBazaar/components/CustomScrollBar';
import {
  BidTGLD,
  BidTGLDMode,
} from 'components/Pages/Core/DappPages/SpiceBazaar/BidTGLD/BidTGLD';
import { InputSelect } from 'components/InputSelect/InputSelect';

export type Transaction = {
  epochId: string;
  auctionEndDateTime: string;
  bidAmount: string;
  claimableTokens: number | undefined;
  unit: string;
  unitPrice: string;
  action: 'Bid' | 'Claim' | '';
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

const metricOptions1: { value: string; label: string }[] = [
  { label: 'Chain 1', value: 'chain1' },
  { label: 'Chain 2', value: 'chain2' },
  { label: 'Chain 3', value: 'chain3' },
];

const metricOptions2: { value: string; label: string }[] = [
  { label: 'All Tokens', value: 'allTokens' },
  { label: 'Opt 2', value: 'opt2' },
  { label: 'Opt 3', value: 'opt3' },
];

export const DataTable: React.FC<TableProps> = ({
  modal,
  tableHeaders,
  transactions,
  loading,
  title,
  refetch,
}) => {
  const [modalState, setModalState] = useState<'closed' | 'bidDai' | 'bidTgld'>(
    'closed'
  );

  const [currentBidAmount, setCurrentBidAmount] = useState<string>('');

  const [filter, setFilter] = useState('Last 5 Shown');
  const [filteredTransactions, setFilteredTransactions] =
    useState<Transaction[]>(transactions);
  const filterOptions = ['Last 5 Shown', 'Show All'];

  const [selectedMetric1, setSelectedMetric1] = useState('chain1');
  const [selectedMetric2, setSelectedMetric2] = useState('allTokens');

  const selectMetric1 = (metric: string) => {
    setSelectedMetric1(metric);
  };
  const selectMetric2 = (metric: string) => {
    setSelectedMetric2(metric);
  };

  const {
    daiGoldAuctions: { claim: daiGoldAuctionClaim },
  } = useSpiceBazaar();

  useEffect(() => {
    const sortedTransactions = [...transactions].sort(
      (a, b) => Number(b.epochId) - Number(a.epochId)
    );

    if (filter === 'Last 5 Shown') {
      setFilteredTransactions(sortedTransactions.slice(0, 5));
    } else {
      setFilteredTransactions(sortedTransactions);
    }
  }, [filter, transactions]);

  const [resolvedActions, setResolvedActions] = useState<
    Record<string, '' | 'Bid' | 'Claim'>
  >({});

  const onBidSubmitted = () => {
    refetch?.();
    setModalState('closed');
  };

  useEffect(() => {
    const resolveActions = async () => {
      const resolved = await Promise.all(
        transactions.map(async (transaction) => ({
          epochId: transaction.epochId,
          action: await transaction.action,
        }))
      );

      setResolvedActions(
        resolved.reduce((acc, curr) => {
          acc[curr.epochId] = curr.action;
          return acc;
        }, {} as Record<string, 'Bid' | 'Claim' | ''>) // The state will hold "Bid", "Claim", or ""
      );
    };
    resolveActions();
  }, [transactions]);

  return (
    <>
      <PageContainer>
        <Header>
          <HeaderLeft>
            <Title>{title}</Title>
            <Options>
              <SelectMetricContainer1>
                <InputSelect
                  options={metricOptions1}
                  defaultValue={metricOptions1.find(
                    (m) => m.value === selectedMetric1
                  )}
                  onChange={(e) => selectMetric1(e.value)}
                  isSearchable={false}
                  fontSize={'16px'}
                  fontWeight={'400'}
                />
              </SelectMetricContainer1>
              <SelectMetricContainer2>
                <InputSelect
                  options={metricOptions2}
                  defaultValue={metricOptions2.find(
                    (m) => m.value === selectedMetric2
                  )}
                  onChange={(e) => selectMetric2(e.value)}
                  isSearchable={false}
                  fontSize={'16px'}
                  fontWeight={'400'}
                />
              </SelectMetricContainer2>
            </Options>
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
                    {h.name}
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
                  const action = resolvedActions[transaction.epochId];
                  return (
                    <DataRow key={transaction.epochId}>
                      <DataCell>{transaction.epochId}</DataCell>
                      <DataCell>
                        {new Date(
                          Number(transaction.auctionEndDateTime) * 1000
                        ).toLocaleDateString('en-GB')}
                      </DataCell>
                      <DataCell>{transaction.bidAmount} USDS</DataCell>
                      <DataCell>
                        {transaction.claimableTokens
                          ? formatNumberWithCommas(transaction.claimableTokens)
                          : ' - '}
                      </DataCell>
                      <DataCell>{transaction.unit}</DataCell>
                      <DataCell>{transaction.unitPrice}</DataCell>
                      <DataCell>
                        <ButtonContainer>
                          {action === 'Bid' && (
                            <TradeButton
                              onClick={() => {
                                setCurrentBidAmount(transaction.bidAmount);
                                setModalState(modal);
                              }}
                              style={{ whiteSpace: 'nowrap', margin: 0 }}
                            >
                              Increase Bid
                            </TradeButton>
                          )}
                          {action === 'Claim' &&
                            Number(transaction.claimableTokens) > 0 && (
                              <TradeButton
                                onClick={async () => {
                                  await daiGoldAuctionClaim(
                                    Number(transaction.epochId)
                                  );
                                  refetch?.();
                                }}
                                style={{ whiteSpace: 'nowrap', margin: 0 }}
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
      <Popover
        isOpen={modalState != 'closed'}
        onClose={() => setModalState('closed')}
        closeOnClickOutside
        showCloseButton
      >
        {modal === 'bidDai' && (
          <BidUSDS
            onBidSubmitted={onBidSubmitted}
            mode={BidUSDSMode.IncreaseBid}
            currentBidAmount={currentBidAmount}
          />
        )}
        {modal === 'bidTgld' && <BidTGLD mode={BidTGLDMode.IncreaseBid} />}
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

const Options = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 20px;
  width: 320px;
`;

const SelectMetricContainer1 = styled.div`
  flex: 1;
  max-width: 120px;
`;

const SelectMetricContainer2 = styled.div`
  flex: 1;
  max-width: 130px;
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
  padding: 20px 25px;
  font-size: 13px;
  font-weight: 700;
  line-height: 20px;
  text-align: left;
  padding-top: 5px;
  color: ${({ theme }) => theme.palette.brand};
  white-space: ${({ name }) => (name.includes('\n') ? 'pre-wrap' : 'nowrap')};
  position: sticky;
  top: 0;
  z-index: 1;

  &:first-child {
    padding: 20px 25px 20px 0px;
  }
`;

const DataRow = styled.tr`
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
`;

const DataCell = styled.td`
  font-size: 13px;
  font-weight: 700;
  line-height: 20px;
  text-align: left;
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
