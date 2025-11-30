import styled from 'styled-components';
import { DataTable } from '../DataTables/ClaimHistoryDataTable';
import { useClaimHistory } from '../hooks/use-claim-history';

enum TableHeaders {
  GrantDate = 'Grant Date',
  ClaimedTgld = 'Claimed TGLD',
  TransactionLink = 'Transaction Link',
}

const tableHeaders = [
  { name: TableHeaders.GrantDate },
  { name: TableHeaders.ClaimedTgld },
  { name: TableHeaders.TransactionLink },
];

export const ClaimHistory = () => {
  const { data } = useClaimHistory();

  return (
    <AuctionsHistoryContainer>
      <DataTable
        tableHeaders={tableHeaders}
        transactions={data || []}
        loading={false}
      />
    </AuctionsHistoryContainer>
  );
};

const AuctionsHistoryContainer = styled.div`
  display: flex;
  flex-direction: column;
`;
