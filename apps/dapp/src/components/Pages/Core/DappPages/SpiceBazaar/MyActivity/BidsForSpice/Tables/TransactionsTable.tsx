import styled from 'styled-components';
import { DataTable } from '../../DataTables/TransactionsDataTable';
import type { Transaction } from '../../DataTables/TransactionsDataTable';

enum TableHeaders {
  Epoch = 'EPOCH',
  Type = 'Type',
  TransactionLink = 'Transaction Link',
}

const data: Transaction[] = [
  {
    epoch: '12/11/2024',
    type: 'Bid',
    transactionLink: '0x192c453a2dbb0b...0e74a056',
  },
  {
    epoch: '12/11/2024',
    type: 'Claim',
    transactionLink: '0x342c4535430979a...0b6b8b25',
  },
  {
    epoch: '12/11/2024',
    type: 'Bid',
    transactionLink: '0x192c453a2dbb0b...0e74a056',
  },
  {
    epoch: '12/11/2024',
    type: 'Bid',
    transactionLink: '0x192c453a2dbb0b...0e74a056',
  },
  {
    epoch: '12/11/2024',
    type: 'Claim',
    transactionLink: '0x192c453a2dbb0b...0e74a056',
  },
  {
    epoch: '12/11/2024',
    type: 'Claim',
    transactionLink: '0x192c453a2dbb0b...0e74a056',
  },
  {
    epoch: '12/11/2024',
    type: 'Claim',
    transactionLink: '0x192c453a2dbb0b...0e74a056',
  },
];

const tableHeaders = [
  { name: TableHeaders.Epoch },
  { name: TableHeaders.Type },
  { name: TableHeaders.TransactionLink },
];

export const TransactionsHistory = () => {
  return (
    <AuctionsHistoryContainer>
      <DataTable
        tableHeaders={tableHeaders}
        transactions={data}
        loading={false}
      />
    </AuctionsHistoryContainer>
  );
};

const AuctionsHistoryContainer = styled.div`
  display: flex;
  flex-direction: column;
`;
