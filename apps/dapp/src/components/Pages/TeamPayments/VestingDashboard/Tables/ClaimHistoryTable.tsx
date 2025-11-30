import styled from 'styled-components';
import { DataTable } from '../DataTables/ClaimHistoryDataTable';
import { useAllClaimHistory } from '../hooks/use-all-claim-history';

enum TableHeaders {
  GrantDate = 'Grant Date',
  ClaimedTgld = 'Claimed TGLD',
  GranteeAddress = 'Grantee Address',
  TransactionLink = 'Transaction Link',
}

const tableHeaders = [
  { name: TableHeaders.GrantDate },
  { name: TableHeaders.ClaimedTgld },
  { name: TableHeaders.GranteeAddress },
  { name: TableHeaders.TransactionLink },
];

export const ClaimHistory = ({ walletAddress }: { walletAddress?: string }) => {
  // Fetch claim transactions (all users or filtered by walletAddress)
  const { transactions, loading } = useAllClaimHistory(walletAddress);

  return (
    <AuctionsHistoryContainer>
      <DataTable
        tableHeaders={tableHeaders}
        transactions={transactions}
        loading={loading}
      />
    </AuctionsHistoryContainer>
  );
};

const AuctionsHistoryContainer = styled.div`
  display: flex;
  flex-direction: column;
`;
