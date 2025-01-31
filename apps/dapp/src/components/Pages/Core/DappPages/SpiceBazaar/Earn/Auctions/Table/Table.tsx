import styled from 'styled-components';
import { DataTable } from './DataTable';
import { useAuctionsHistory } from '../hooks/use-auctions-history';

export const AuctionsHistory = () => {
  const { data, loading, error, refetch } = useAuctionsHistory();

  return (
    <AuctionsHistoryContainer>
      <DataTable
        transactions={data || []}
        loading={loading}
        refetch={refetch}
      />
    </AuctionsHistoryContainer>
  );
};

const AuctionsHistoryContainer = styled.div`
  display: flex;
  flex-direction: column;
`;
