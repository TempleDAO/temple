import styled from 'styled-components';

export type TableRow = {
  date: string;
  dToken: string;
  borrow: number;
  repay: number;
  txHash: string;
};

type Props = {
  dataSubset: TableRow[];
};
export const TxnDataTable = ({ dataSubset }: Props) => {
  return (
    <DataTable>
      <thead>
        <tr>
          <TableHeader>Date</TableHeader>
          <TableHeader>Debt Token</TableHeader>
          <TableHeader>Borrow</TableHeader>
          <TableHeader>Repay</TableHeader>
          <TableHeader>Tx Hash</TableHeader>
        </tr>
      </thead>
      <tbody>
        {dataSubset.map((row, index) => (
          <DataRow key={index}>
            <DataCell>{row.date}</DataCell>
            <DataCell>{row.dToken}</DataCell>
            <DataCell>{row.borrow}</DataCell>
            <DataCell>{row.repay}</DataCell>
            <DataCell>{row.txHash.slice(0, 12) + '...'}</DataCell>
          </DataRow>
        ))}
      </tbody>
    </DataTable>
  );
};

const TableHeader = styled.th`
  text-align: left;
  padding: 8px;
`;

const DataTable = styled.table`
  border-collapse: collapse;
  color: ${({ theme }) => theme.palette.brand};
`;

const DataRow = styled.tr`
  border-top: 1px solid ${({ theme }) => theme.palette.brand};
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
`;

const DataCell = styled.td`
  padding: 8px;
  text-align: left;
  color: ${({ theme }) => theme.palette.brandLight};
`;
