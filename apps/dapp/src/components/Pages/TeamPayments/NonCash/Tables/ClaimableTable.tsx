import styled from 'styled-components';
import { DataTable } from '../DataTables/ClaimableDataTable';
import { useClaimableTGLD } from '../hooks/use-claimable-tgld';

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

export const ClaimableTGLD = () => {
  const { data, loading, claimTgld } = useClaimableTGLD();

  return (
    <AuctionsHistoryContainer>
      <DataTable
        transactions={data || []}
        loading={loading}
        title="Claimable TGLD"
        tableHeaders={tableHeaders}
        claimTgld={claimTgld}
      />
    </AuctionsHistoryContainer>
  );
};

const AuctionsHistoryContainer = styled.div`
  display: flex;
  flex-direction: column;
`;
