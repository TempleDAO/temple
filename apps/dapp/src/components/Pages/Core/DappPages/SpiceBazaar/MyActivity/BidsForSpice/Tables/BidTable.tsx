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
    epochId: 1,
    auctionEndDateTime: '30.09.2024',
    bidAmount: 100,
    claimableTokens: '-',
    unit: 'WSBI',
    unitPrice: '-',
    claim: '',
    increase: '',
  },
  {
    epochId: 2,
    auctionEndDateTime: '14.10.2024',
    bidAmount: 100,
    claimableTokens: 100000,
    unit: 'WSBI',
    unitPrice: 231,
    claim: '',
    increase: '',
  },
  {
    epochId: 3,
    auctionEndDateTime: '28.10.2024',
    bidAmount: 100,
    claimableTokens: 200000,
    unit: 'ENA',
    unitPrice: 99,
    claim: '',
    increase: '',
  },
  {
    epochId: 4,
    auctionEndDateTime: '28.10.2024',
    bidAmount: 100,
    claimableTokens: 150000,
    unit: 'WSBI',
    unitPrice: 78,
    claim: '',
    increase: '',
  },
  {
    epochId: 5,
    auctionEndDateTime: '-',
    bidAmount: 100,
    claimableTokens: '-',
    unit: 'ENA',
    unitPrice: '-',
    claim: '',
    increase: '',
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
