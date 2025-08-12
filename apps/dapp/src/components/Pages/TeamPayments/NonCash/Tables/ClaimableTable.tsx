import styled from 'styled-components';
import { DataTable } from '../DataTables/ClaimableDataTable';

enum TableHeaders {
  Id = 'ID',
  GrantStartDate = 'Grant Start Date',
  GrantEndDate = 'Grant End Date',
  Cliff = 'Cliff',
  VestedAmount = 'Vested Amount',
  ClaimableAmount = 'Claimable Amount',
  Action = '',
}

const tableHeaders = [
  { name: TableHeaders.Id },
  { name: TableHeaders.GrantStartDate },
  { name: TableHeaders.GrantEndDate },
  { name: TableHeaders.Cliff },
  { name: TableHeaders.VestedAmount },
  { name: TableHeaders.ClaimableAmount },
  { name: TableHeaders.Action },
];

const data = [
  {
    id: 'Sep 2025',
    grantStartDate: 'Sep 2025',
    grantEndDate: 'Sep 2026',
    cliff: '3 months',
    vestedAmount: 133000,
    claimableAmount: 22000,
    action: 'Claim',
  },
  {
    id: 'Aug 2025',
    grantStartDate: 'Aug 2025',
    grantEndDate: 'Aug 2026',
    cliff: '3 months',
    vestedAmount: 200000,
    claimableAmount: 22000,
    action: 'Claim',
  },
];

export const ClaimableTGLD = () => {
  return (
    <AuctionsHistoryContainer>
      <DataTable
        transactions={data || []}
        loading={false}
        title="Claimable TGLD"
        tableHeaders={tableHeaders}
      />
    </AuctionsHistoryContainer>
  );
};

const AuctionsHistoryContainer = styled.div`
  display: flex;
  flex-direction: column;
`;
