import styled from 'styled-components';
import { DataTable } from '../DataTables/BidDataTable';
import { useMyActivityBidsSpiceHistory } from '../hooks/use-myActivity-bidsSpiceHistory';

enum TableHeaders {
  EpochId = 'EPOCH ID',
  AuctionEndDateTime = 'Auction End',
  Claimable = 'Claimable',
  Price = 'Unit Price\n(TGLD)',
  BidTotal = 'Bid Total\n(TGLD)',
  Action = 'Action',
  Token = 'Token',
}

const tableHeaders = [
  { name: TableHeaders.EpochId },
  { name: TableHeaders.AuctionEndDateTime },
  { name: TableHeaders.Claimable },
  { name: TableHeaders.Token },
  { name: TableHeaders.Price },
  { name: TableHeaders.BidTotal },
  { name: TableHeaders.Action },
];

export const BidHistory = () => {
  const { data, loading, refetch } = useMyActivityBidsSpiceHistory();

  return (
    <AuctionsHistoryContainer>
      <DataTable
        transactions={data || []}
        loading={loading}
        refetch={refetch}
        title="Bids for SPICE History"
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
