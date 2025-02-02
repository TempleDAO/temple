import styled from 'styled-components';
import { DataTable } from '../../DataTables/BidDataTable';
import type { Transaction } from '../../DataTables/BidDataTable';

enum TableHeaders {
  EpochId = 'EPOCH\nID',
  AuctionEndDateTime = 'Auction End\nDate/Time',
  BidAmount = 'Bid Amount',
  ClaimableTokens = 'Claimable\nTOKENS',
  Unit = 'Unit',
  UnitPrice = 'Unit Price\n(TGLD)',
  Claim = 'Claim',
  Increase = '',
}

const data: Transaction[] = [
  {
    epochId: '1',
    auctionEndDateTime: '30.09.2024',
    bidAmount: '100',
    claimableTokens: 0,
    unit: 'WSBI',
    unitPrice: '-',
    action: 'Bid',
  },
  {
    epochId: '2',
    auctionEndDateTime: '14.10.2024',
    bidAmount: '100',
    claimableTokens: 100000,
    unit: 'WSBI',
    unitPrice: '231',
    action: 'Bid',
  },
  {
    epochId: '3',
    auctionEndDateTime: '28.10.2024',
    bidAmount: '100',
    claimableTokens: 200000,
    unit: 'ENA',
    unitPrice: '99',
    action: 'Bid',
  },
  {
    epochId: '4',
    auctionEndDateTime: '28.10.2024',
    bidAmount: '100',
    claimableTokens: 150000,
    unit: 'WSBI',
    unitPrice: '78',
    action: 'Bid',
  },
  {
    epochId: '5',
    auctionEndDateTime: '-',
    bidAmount: '100',
    claimableTokens: 0,
    unit: 'ENA',
    unitPrice: '-',
    action: 'Bid',
  },
];

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

export const BidHistory = () => {
  return (
    <AuctionsHistoryContainer>
      <DataTable
        tableHeaders={tableHeaders}
        transactions={data}
        modal="bidTgld"
        loading={false}
        title="Bids for Spice History"
      />
    </AuctionsHistoryContainer>
  );
};

const AuctionsHistoryContainer = styled.div`
  display: flex;
  flex-direction: column;
`;
