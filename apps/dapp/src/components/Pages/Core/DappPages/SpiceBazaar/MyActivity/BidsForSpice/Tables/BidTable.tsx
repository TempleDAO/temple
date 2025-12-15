import styled from 'styled-components';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';
import { DataTableMobile } from '../DataTables/BidDataTableMobile';
import { DataTable } from '../DataTables/BidDataTable';
import { useMyActivityBidsSpiceHistory } from '../hooks/use-myActivity-bidsSpiceHistory';
import { useQueryClient } from '@tanstack/react-query';
import { useSpiceAuction } from 'providers/SpiceAuctionProvider';
import { SpiceAuctionConfig } from 'constants/newenv/types';
import { useEffect } from 'react';

enum TableHeaders {
  EpochId = 'EPOCH ID',
  AuctionName = 'Auction Name',
  AuctionEndDateTime = 'Auction End',
  Claimable = 'Claimable',
  Price = 'Unit Price\n(TGLD)',
  BidTotal = 'Bid Total\n(TGLD)',
  Action = 'Action',
}

const tableHeaders = [
  { name: TableHeaders.EpochId },
  { name: TableHeaders.AuctionName },
  { name: TableHeaders.AuctionEndDateTime },
  { name: TableHeaders.Claimable },
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
  const queryClient = useQueryClient();
  const {
    spiceAuctions,
    allSpiceAuctions: {
      fetch: fetchAllSpiceAuctions,
      data: allSpiceAuctionsData,
      loading: allSpiceAuctionsLoading,
    },
  } = useSpiceAuction();

  useEffect(() => {
    fetchAllSpiceAuctions();
  }, [fetchAllSpiceAuctions]);

  const handleClaim = async (
    auctionStaticConfig: SpiceAuctionConfig,
    epoch: number
  ) => {
    await spiceAuctions.claim(auctionStaticConfig, epoch);
    queryClient.invalidateQueries({
      queryKey: ['currentUserMetrics'],
    });
    queryClient.invalidateQueries({
      queryKey: ['spiceRedeemAmount'],
    });
    refetch?.();
  };

  return (
    <AuctionsHistoryContainer>
      {!isPhoneOrAbove ? (
        <DataTableMobile
          transactions={data || []}
          loading={loading}
          refetch={refetch}
          onClaim={handleClaim}
          title="Bids for SPICE History"
          tableHeaders={tableHeadersMobile}
          modal="bidTgld"
        />
      ) : (
        <DataTable
          transactions={data || []}
          loading={loading}
          refetch={refetch}
          onClaim={handleClaim}
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
