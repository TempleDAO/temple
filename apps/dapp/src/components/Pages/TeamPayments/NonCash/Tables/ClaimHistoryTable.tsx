import styled from 'styled-components';
import { DataTable } from '../DataTables/ClaimHistoryDataTable';

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

const data = [
  {
    grantDate: 'July 2025',
    claimedTgld: '1222000',
    transactionLink: '0x192c453a2dbb0b...0e74a056',
    transactionHash: '0x192c453a2dbb0b...0e74a056',
  },
  {
    grantDate: 'Jan 2025',
    claimedTgld: '700000',
    transactionLink: '0x342c4535430979a...0b6b8b25',
    transactionHash: '0x342c4535430979a...0b6b8b25',
  },
];

export const ClaimHistory = () => {
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
