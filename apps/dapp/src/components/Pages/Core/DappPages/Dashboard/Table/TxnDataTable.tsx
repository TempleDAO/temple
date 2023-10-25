import { LoadingText } from 'components/Pages/Core/components/LoaderVault/commons/LoadingText';
import env from 'constants/env/local';
import { StrategyKey } from 'hooks/api/use-react-query';
import styled from 'styled-components';
import { loading } from 'utils/loading-value';

export type TableRow = {
  date: string;
  dToken: string;
  borrow: number;
  repay: number;
  txHash: string;
  type?: StrategyKey;
};

type Props = {
  dataSubset: TableRow[] | undefined;
  dataLoading: boolean;
};

const tableHeaders = [
  "Type",
  "Date",
  "Debt Token",
  "Borrow",
  "Repay",
  "Tx Hash"
];

export const TxnDataTable = (props: Props) => {
  const { dataSubset, dataLoading } = props;
  return (
    <DataTable>
      <thead>
        <tr>
          {tableHeaders.map((t,i) => <TableHeader key={i}>{t}</TableHeader>)}
        </tr>
      </thead>
      <tbody>
        {dataLoading ? (
          [...Array(3)].map((_, index) => ( // Adds 3 loading rows
            <DataRow key={index}>
              {[...Array(tableHeaders.length)].map((_, i) => ( // Adds 5 loading cells, same no of table headers 
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