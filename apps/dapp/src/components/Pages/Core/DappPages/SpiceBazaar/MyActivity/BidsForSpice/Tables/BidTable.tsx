import styled from 'styled-components';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';
import { DataTableMobile } from '../DataTables/BidDataTableMobile';
import { DataTable } from '../DataTables/BidDataTable';
import { useMyActivityBidsSpiceHistory } from '../hooks/use-myActivity-bidsSpiceHistory';

enum TableHeaders {
  EpochId = 'EPOCH ID',
  AuctionName = 'Auction Name',
  AuctionEndDateTime = 'Auction End',
  Claimable = 'Claimable',
  Price = 'Unit Price\n(TGLD)',
  BidTotal = 'Bid Total\n(TGLD)',
  Action = 'Action',
  Token = 'Token',
}

const tableHeaders = [
  { name: TableHeaders.EpochId },
  { name: TableHeaders.AuctionName },
  { name: TableHeaders.AuctionEndDateTime },
  { name: TableHeaders.Claimable },
  { name: TableHeaders.Token },
  { name: TableHeaders.Price },
  { name: TableHeaders.BidTotal },
  { name: TableHeaders.Action },
];

enum TableHeadersMobile {
  AuctionDetails = 'Auction\nDetails',
  TokenAndBidDetails = 'Token and\nBid Details',
  Action = 'Action',
}

const tableHeadersMobile = [
  { name: TableHeadersMobile.AuctionDetails },
  { name: TableHeadersMobile.TokenAndBidDetails },
  { name: TableHeadersMobile.Action },
];

export const BidHistory = () => {
  const isPhoneOrAbove = useMediaQuery({ query: queryPhone });
  const { data, loading, refetch } = useMyActivityBidsSpiceHistory();

  return (
    <AuctionsHistoryContainer>
      {!isPhoneOrAbove ? (
        <DataTableMobile
          transactions={data || []}
          loading={loading}
          refetch={refetch}
          title="Bids for SPICE History"
          tableHeaders={tableHeadersMobile}
          modal="bidTgld"
        />
      ) : (
        <DataTable
          transactions={data || []}
          loading={loading}
          refetch={refetch}
          title="Bids for SPICE History"
          tableHeaders={tableHeaders}
          modal="bidTgld"
        />
      )}
    </AuctionsHistoryContainer>
  );
};

const AuctionsHistoryContainer = styled.div`
  display: flex;
  flex-direction: column;
`;
