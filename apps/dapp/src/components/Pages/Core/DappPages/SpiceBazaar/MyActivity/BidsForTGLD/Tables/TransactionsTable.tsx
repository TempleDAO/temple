import styled from 'styled-components';
import { DataTable } from '../../DataTables/TransactionsDataTable';
import { useMyActivityTxnHistory } from '../hooks/use-myActivity-txnHistory';

enum TableHeaders {
  Epoch = 'EPOCH',
  Type = 'Type',
  TransactionLink = 'Transaction Link',
}

const tableHeaders = [
  { name: TableHeaders.Epoch },
  { name: TableHeaders.Type },
  { name: TableHeaders.TransactionLink },
];

export const TransactionsHistory = () => {
  const { data, loading, error, refetch } = useMyActivityTxnHistory();

  return (
    <AuctionsHistoryContainer>
      <DataTable
        tableHeaders={tableHeaders}
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
