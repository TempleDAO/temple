import styled from 'styled-components';
import { DataTable } from '../../DataTables/BidDataTable';
import { useMyActivityBidsTGLDHistory } from '../hooks/use-myActivity-bidsTGLDHistory';

enum TableHeaders {
  EpochId = 'EPOCH\nID',
  AuctionEndDateTime = 'Auction End\nDate/Time',
  BidAmount = 'Bid Amount',
  Claimable = 'Claimable',
  Token = 'Token',
  Price = 'Price in USDS',
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
  const { data, loading, error, refetch } = useMyActivityBidsTGLDHistory();

  return (
    <AuctionsHistoryContainer>
      <DataTable
        transactions={data || []}
        loading={loading}
        refetch={refetch}
        title="Bids for TGLD History"
        tableHeaders={tableHeaders}
        modal={'bidDai'}
      />
    </AuctionsHistoryContainer>
  );
};

const AuctionsHistoryContainer = styled.div`
  display: flex;
  flex-direction: column;
`;
