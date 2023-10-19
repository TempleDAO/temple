import { LoadingText } from 'components/Pages/Core/components/LoaderVault/commons/LoadingText';
import styled from 'styled-components';
import { loading } from 'utils/loading-value';

export type TableRow = {
  date: string;
  dToken: string;
  borrow: number;
  repay: number;
  txHash: string;
};

type Props = {
  dataSubset: TableRow[];
  dataLoading: boolean;
};
export const TxnDataTable = (props: Props) => {
  const { dataSubset, dataLoading } = props;
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
        {dataLoading ? (
          [...Array(3)].map((_, index) => ( // Adds 3 loading rows
            <DataRow key={index}>
              {[...Array(5)].map((_, i) => ( // Adds 5 loading cells, same no of table headers 
                <DataCell key={i}>
                  <LoadingText value={loading()} />
                </DataCell>
              ))}
            </DataRow>
          ))
        ) : dataSubset.length === 0 ? (
          <DataRow>
            <DataCell>No data available</DataCell>
          </DataRow>
        ) : (
          dataSubset.map((row, index) => (
            <DataRow key={index}>
              <DataCell>{row.date}</DataCell>
              <DataCell>{row.dToken}</DataCell>
              <DataCell>{row.borrow}</DataCell>
              <DataCell>{row.repay}</DataCell>
              <DataCell>{row.txHash.slice(0, 12) + '...'}</DataCell>
            </DataRow>
          ))
        )}
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
