import styled from 'styled-components';
import { DataTable } from './DataTable';
import { useBidsHistory } from '../hooks/use-bids-history';
import { DaiGoldAuctionInfo } from 'providers/SpiceBazaarProvider';

export const BidHistory = ({
  auctionInfo,
}: {
  auctionInfo: DaiGoldAuctionInfo;
}) => {
  const { data, loading, error, refetch } = useBidsHistory(auctionInfo);

  return (
    <BidHistoryContainer>
      <DataTable bids={data || []} loading={loading} refetch={refetch} />
    </BidHistoryContainer>
  );
};

const BidHistoryContainer = styled.div`
  display: flex;
  flex-direction: column;
`;
