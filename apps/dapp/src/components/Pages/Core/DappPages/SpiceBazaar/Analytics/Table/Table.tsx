import styled from 'styled-components';
import { DataTable } from './DataTable';
import type { Transaction } from './DataTable';

enum TableHeaders {
  Date = 'Date',
  Debit = 'Debit',
  Credit = 'Credit',
}

const data: Transaction[] = [
  {
    key: 1,
    date: '02/11/2024',
    debit: '-',
    credit: 20832.81,
  },
  {
    key: 2,
    date: '02/11/2024',
    debit: '-',
    credit: 5891.0,
  },
  {
    key: 3,
    date: '02/11/2024',
    debit: 1200.9,
    credit: '-',
  },
  {
    key: 4,
    date: '02/11/2024',
    debit: 1200.9,
    credit: '-',
  },
  {
    key: 5,
    date: '02/11/2024',
    debit: 1200.9,
    credit: '-',
  },
  {
    key: 6,
    date: '12/11/2024',
    debit: 1200.9,
    credit: '-',
  },
  {
    key: 7,
    date: '02/11/2024',
    debit: 1200.9,
    credit: '-',
  },
  {
    key: 8,
    date: '02/11/2024',
    debit: 1200.9,
    credit: '-',
  },
  {
    key: 9,
    date: '02/11/2024',
    debit: 1200.9,
    credit: '-',
  },
  {
    key: 10,
    date: '02/11/2024',
    debit: 1200.9,
    credit: '-',
  },
  {
    key: 11,
    date: '02/11/2024',
    debit: 1200.9,
    credit: '-',
  },
  {
    key: 12,
    date: '02/11/2024',
    debit: 1200.9,
    credit: '-',
  },
  {
    key: 13,
    date: '02/11/2024',
    debit: 1200.9,
    credit: '-',
  },
  {
    key: 14,
    date: '02/11/2024',
    debit: 1200.9,
    credit: '-',
  },
  {
    key: 15,
    date: '02/11/2024',
    debit: 1200.9,
    credit: '-',
  },
  {
    key: 16,
    date: '02/11/2024',
    debit: 1200.9,
    credit: '-',
  },
  {
    key: 17,
    date: '12/12/2024',
    debit: 1200.9,
    credit: '-',
  },
  {
    key: 18,
    date: '12/12/2024',
    debit: 1200.9,
    credit: '-',
  },
  {
    key: 19,
    date: '12/12/2024',
    debit: 1200.9,
    credit: '-',
  },
  {
    key: 20,
    date: '12/12/2024',
    debit: 1200.9,
    credit: '-',
  },
  {
    key: 21,
    date: '12/12/2024',
    debit: 1200.9,
    credit: '-',
  },
  {
    key: 22,
    date: '12/12/2024',
    debit: 1200.9,
    credit: '-',
  },
];

const tableHeaders = [
  { name: TableHeaders.Date },
  { name: TableHeaders.Debit },
  { name: TableHeaders.Credit },
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
