import styled from 'styled-components';
import { DataTable } from '../../DataTables/BidDataTable';
import { useMyActivityBidsSpiceHistory } from '../hooks/use-myActivity-bidsSpiceHistory';

enum TableHeaders {
  EpochId = 'EPOCH\nID',
  AuctionEndDateTime = 'Auction End\nDate/Time',
  BidAmount = 'Bid Amount',
  Claimable = 'Claimable',
  Token = 'Token',
  Price = 'Price in TGLD',
  Action = 'Action',
}

const tableHeaders = [
  { name: TableHeaders.EpochId },
  { name: TableHeaders.AuctionEndDateTime },
  { name: TableHeaders.BidAmount },
  { name: TableHeaders.Claimable },
  { name: TableHeaders.Token },
  { name: TableHeaders.Price },
  { name: TableHeaders.Action },
];

export const BidHistory = () => {
  const { data, loading, error, refetch } = useMyActivityBidsSpiceHistory();

  return (
    <AuctionsHistoryContainer>
      <DataTable
        transactions={data || []}
        loading={loading}
        refetch={refetch}
        title="Bids for Spice History"
        tableHeaders={tableHeaders}
        modal="bidTgld"
      />
    </AuctionsHistoryContainer>
  );
};

const AuctionsHistoryContainer = styled.div`
  display: flex;
  flex-direction: column;
`;
