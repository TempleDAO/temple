import styled from 'styled-components';
import { DataTable } from './DataTable';
import { useBidDetails } from '../hooks/use-bid-details';

export const AuctionsHistory = () => {
  const { data, loading, error, refetch } = useBidDetails();

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
