import { LoadingText } from 'components/Pages/Core/components/LoaderVault/commons/LoadingText';
import env from 'constants/env/local';
import styled from 'styled-components';
import { loading } from 'utils/loading-value';
import { StrategyType } from '../hooks/use-dashboardv2-txHistory';

export type TableRow = {
  date: string;
  dToken: string;
  borrow: number;
  repay: number;
  txHash: string;
  type?: StrategyType;
};

type Props = {
  dataSubset: TableRow[] | undefined;
  dataLoading: boolean;
};
export const TxnDataTable = (props: Props) => {
  const { dataSubset, dataLoading } = props;
  return (
    <DataTable>
      <thead>
        <tr>
          <TableHeader>Type</TableHeader>
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
        ) : !dataSubset || dataSubset.length === 0 ? (
          <DataRow>
            <DataCell>No data available</DataCell>
          </DataRow>
        ) : (
          dataSubset.map((row, index) => (
            <DataRow key={index}>
              <DataCell>{row.type}</DataCell>
              <DataCell>{row.date}</DataCell>
              <DataCell>{row.dToken}</DataCell>
              <DataCell>{row.borrow}</DataCell>
              <DataCell>{row.repay}</DataCell>
              <DataCell><LinkStyled href={`${env.etherscan}/tx/${row.txHash}`} target='_blank'>{row.txHash.slice(0, 12) + '...'}</LinkStyled></DataCell>
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

const LinkStyled = styled.a`
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 0.9rem;
  font-weight: 300;
  &:hover {
    color: ${({ theme }) => theme.palette.brandDark};
  }
`;