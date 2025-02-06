import styled from 'styled-components';
import { DataTable } from './DataTable';
import { useBidsHistory } from '../hooks/use-bids-history';

export const AuctionsHistory = () => {
  const { data, loading, error, refetch } = useBidsHistory();

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
