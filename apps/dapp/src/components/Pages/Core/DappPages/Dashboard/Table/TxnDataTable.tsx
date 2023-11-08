import { LoadingText } from 'components/Pages/Core/components/LoaderVault/commons/LoadingText';
import env from 'constants/env/local';
import styled from 'styled-components';
import { loading } from 'utils/loading-value';
import { StrategyKey } from '../hooks/use-dashboardv2-metrics';
import { ArrowButtonUpDown } from 'components/Pages/Ascend/components/Trade/styles';
import { TxHistoryTableHeader } from './TxnHistoryTable';
import { InputSelect } from 'components/InputSelect/InputSelect';

export enum TxType {
  Borrow = 'Borrow',
  Repay = 'Repay',
}

export type TableRow = {
  date: string;
  type: TxType;
  strategy?: StrategyKey;
  token: string;
  amount: number;
  txHash: string;
};

type Props = {
  dataSubset: TableRow[] | undefined;
  dataLoading: boolean;
  dataRefetching: boolean;
  tableHeaders: TxHistoryTableHeader[];
  updateTableHeadersOrder: (currentHeader: TxHistoryTableHeader) => void;
};

export const TxnDataTable = (props: Props) => {
  const { dataSubset, dataLoading, dataRefetching, tableHeaders, updateTableHeadersOrder } = props;

  return (
    <DataTable>
      <thead>
        <HeaderRow>
          {tableHeaders.map((h, i) => (
            <TableHeader key={i}>
              <InnerDataRow onClick={() => updateTableHeadersOrder(h)}>
                {h.name}
                {h.orderDesc !== undefined ? <ArrowButtonUpDown clicked={h.orderDesc} /> : <EmptySpace />}
              </InnerDataRow>
              {h.filter && h.dropdownOptions && (
                <InputSelect
                  onChange={h.filter}
                  options={h.dropdownOptions}
                  defaultValue={h.dropdownOptions[0]}
                  fontSize="0.68rem"
                  textAlign="left"
                />
              )}
            </TableHeader>
          ))}
        </HeaderRow>
      </thead>
      <tbody>
        {dataLoading ? (
          loadSkeletonRows(1, tableHeaders.length)
        ) : !dataSubset || dataSubset.length === 0 ? (
          <DataRow>
            <DataCell>No data available</DataCell>
          </DataRow>
        ) : (
          <>
            {dataRefetching && loadSkeletonRows(1, tableHeaders.length)}
            {dataSubset.map((row, index) => (
              <DataRow key={index}>
                <DataCell>{row.date}</DataCell>
                <DataCell>{row.type}</DataCell>
                <DataCell>{row.strategy}</DataCell>
                <DataCell>{row.token}</DataCell>
                <DataCell>{row.amount}</DataCell>
                <DataCell>
                  <LinkStyled href={`${env.etherscan}/tx/${row.txHash}`} target="_blank">
                    {row.txHash.slice(0, 12) + '...'}
                  </LinkStyled>
                </DataCell>
              </DataRow>
            ))}
          </>
        )}
      </tbody>
    </DataTable>
  );
};

const loadSkeletonRows = (skeletonRowsNo: number, skeletonColumnsNo: number) => {
  return [...Array(skeletonRowsNo)].map((_, index) => (
    <DataRow key={index}>
      {[...Array(skeletonColumnsNo)].map(
        (
          _,
          i // Adds x no of loading cells, same as no of table headers
        ) => (
          <DataCell key={i}>
            <LoadingText value={loading()} />
          </DataCell>
        )
      )}
    </DataRow>
  ));
};

const TableHeader = styled.th`
  vertical-align: top;
  text-align: left;
  padding: 8px;
  cursor: pointer;
`;

const HeaderRow = styled.tr`
  overflow: hidden;
  white-space: nowrap;
`;

const InnerDataRow = styled.div`
  display: flex;
  height: 1.5rem;
`;

const EmptySpace = styled.p`
  width: 21px;
`;

const DataTable = styled.table`
  border-collapse: collapse;
  color: ${({ theme }) => theme.palette.brand};
`;

const DataRow = styled.tr`
  overflow: hidden;
  white-space: nowrap;
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

