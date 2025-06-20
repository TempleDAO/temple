import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Button } from 'components/Button/Button';
import { Popover } from 'components/Pages/Core/DappPages/SpiceBazaar/components/Popover';
import * as breakpoints from 'styles/breakpoints';
import { BidUSDS, BidUSDSMode } from '../../../Bid/BidUSDS';
import { formatNumberWithCommas } from 'utils/formatter';
import { ScrollBar } from 'components/Pages/Core/DappPages/SpiceBazaar/components/CustomScrollBar';
import {
  BidTGLD,
  BidTGLDMode,
} from 'components/Pages/Core/DappPages/SpiceBazaar/Spend/BidTGLD';
import { useSpiceAuction } from 'providers/SpiceAuctionProvider';
import { SpiceAuctionConfig } from 'constants/newenv/types';

export type Transaction = {
  id: string;
  epoch: string;
  auctionEndDateTime: string;
  claimableTokens: number | undefined;
  unitPrice: string;
  bidTotal: string;
  action: 'Bid' | 'Claim' | '';
  auctionTokenSymbol?: string;
  name?: string;
  auctionStaticConfig: SpiceAuctionConfig;
  token: string;
};

type TableHeadersMobile = { name: string };

export enum FieldLabels {
  Epoch = 'Epoch ID',
  AuctionName = 'Auction Name',
  AuctionEnd = 'Auction End',
  Claimable = 'Claimable',
  UnitPrice = 'Unit Price',
  BidTotal = 'Bid Total',
}

type TableProps = {
  tableHeaders: TableHeadersMobile[];
  transactions: Transaction[];
  modal: 'bidDai' | 'bidTgld';
  loading: boolean;
  title: string;
  refetch?: () => void;
  dataRefetching?: boolean;
};

export const DataTableMobile: React.FC<TableProps> = ({
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

  const [filter, setFilter] = useState('Last 3 Shown');
  const [filteredTransactions, setFilteredTransactions] =
    useState<Transaction[]>(transactions);
  const filterOptions = ['Last 3 Shown', 'Show All'];

  const {
    allSpiceAuctions: {
      fetch: fetchAllSpiceAuctions,
      data: allSpiceAuctionsData,
      loading: allSpiceAuctionsLoading,
    },
    spiceAuctions: { claim: spiceAuctionClaim },
  } = useSpiceAuction();

  useEffect(() => {
    fetchAllSpiceAuctions();
  }, [fetchAllSpiceAuctions]);

  useEffect(() => {
    const sortedTransactions = [...transactions].sort(
      (a, b) => Number(b.auctionEndDateTime) - Number(a.auctionEndDateTime)
    );

    if (filter === 'Last 3 Shown') {
      setFilteredTransactions(sortedTransactions.slice(0, 3));
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
          kekId: transaction.auctionEndDateTime,
          action: await transaction.action,
        }))
      );

      setResolvedActions(
        resolved.reduce((acc, curr) => {
          acc[curr.kekId] = curr.action;
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
                    {h.name.includes('\n')
                      ? h.name.split('\n').map((line, i) => (
                          <React.Fragment key={h.name}>
                            {line}
                            <br />
                          </React.Fragment>
                        ))
                      : h.name}
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
                  const action =
                    resolvedActions[transaction.auctionEndDateTime];
                  return (
                    <CardRow key={transaction.auctionEndDateTime}>
                      <DataCell>
                        <DataRowContainer>
                          <DataRowTitle>{FieldLabels.Epoch}:</DataRowTitle>
                          <DataRowValue>{transaction.epoch}</DataRowValue>
                        </DataRowContainer>
                        <DataRowContainer>
                          <DataRowTitle>
                            {FieldLabels.AuctionName}:
                          </DataRowTitle>
                          <DataRowValue>{transaction.name || '-'}</DataRowValue>
                        </DataRowContainer>
                        <DataRowContainer>
                          <DataRowTitle>{FieldLabels.AuctionEnd}:</DataRowTitle>
                          <DataRowValue>
                            {new Date(
                              Number(transaction.auctionEndDateTime) * 1000
                            ).toLocaleDateString('en-GB')}
                          </DataRowValue>
                        </DataRowContainer>
                      </DataCell>
                      <DataCell>
                        <DataRowContainer>
                          <DataRowTitle>{FieldLabels.Claimable}:</DataRowTitle>
                          <DataRowValue>
                            {transaction.claimableTokens !== undefined
                              ? formatNumberWithCommas(
                                  transaction.claimableTokens
                                )
                              : '-'}
                            {transaction.claimableTokens !== undefined
                              ? ' ' + transaction.token
                              : ''}
                          </DataRowValue>
                        </DataRowContainer>
                        <DataRowContainer>
                          <DataRowTitle>{FieldLabels.UnitPrice}:</DataRowTitle>
                          <DataRowValue>
                            {transaction.unitPrice} TGLD
                          </DataRowValue>
                        </DataRowContainer>
                        <DataRowContainer>
                          <DataRowTitle>{FieldLabels.BidTotal}:</DataRowTitle>
                          <DataRowValue>
                            {transaction.bidTotal} TGLD
                          </DataRowValue>
                        </DataRowContainer>
                      </DataCell>
                      <DataCell>
                        <ButtonContainer>
                          {action === 'Bid' && (
                            <TradeButton
                              onClick={() => {
                                console.log(
                                  'Setting currentBidAmount:',
                                  transaction.bidTotal
                                );
                                setCurrentBidAmount(transaction.bidTotal);
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
                                  await spiceAuctionClaim(
                                    transaction.auctionStaticConfig,
                                    Number(transaction.epoch)
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
                    </CardRow>
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
        {modal === 'bidTgld' && (
          <BidTGLD
            mode={BidTGLDMode.IncreaseBid}
            currentBidAmount={currentBidAmount}
            onBidSuccess={async () => {
              await refetch?.();
              setModalState('closed');
            }}
            isLoadingUserMetrics={false}
            auctionConfig={(() => {
              const transaction = transactions.find(
                (t) => Number(t.bidTotal) === Number(currentBidAmount)
              );

              return transaction?.auctionStaticConfig;
            })()}
          />
        )}
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
  border-collapse: collapse;
  width: 100%;
`;

const HeaderRow = styled.tr`
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
`;

const TableHeader = styled.th<{ name: string }>`
  width: 33%;
  white-space: pre-wrap;
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
  text-align: left;
  padding-top: 5px;
  color: ${({ theme }) => theme.palette.brand};
  white-space: ${({ name }) => (name.includes('\n') ? 'pre-wrap' : 'nowrap')};
  position: sticky;
  top: 0;
  z-index: 1;
`;

const DataRow = styled.tr`
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
`;

const CardRow = styled.tr`
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
`;

const DataRowContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding-bottom: 16px;

  &:last-child {
    padding-bottom: 20px;
  }
`;

const DataRowTitle = styled.span`
  color: ${({ theme }) => theme.palette.brandDark};
`;

const DataRowValue = styled.span`
  color: ${({ theme }) => theme.palette.brandLight};
`;

const DataCell = styled.td`
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
  text-align: left;
  color: ${({ theme }) => theme.palette.brandLight};
  padding-top: 20px;
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
  width: ${(props) => props.width || '75px'};
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
