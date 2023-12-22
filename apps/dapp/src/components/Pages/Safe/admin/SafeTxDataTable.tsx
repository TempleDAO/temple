import { useState, useEffect, useRef, Fragment } from 'react';
import { LoadingText } from 'components/Pages/Core/components/LoaderVault/commons/LoadingText';
import env from 'constants/env';
import styled from 'styled-components';
import { loading } from 'utils/loading-value';
import { Button } from 'components/Button/Button';

export type SafeStatus = 'unknown' | 'awaiting_signing' | 'awaiting_execution' | 'executing';

export type SafeTableRow = {
  date: string;
  txHash: string;
  status: SafeStatus;
  confirmations: string;
  alreadySigned: boolean;
  isOwner: boolean;
  nonce: number;
  action: () => void;
};

type Props = {
  dataSubset: SafeTableRow[] | undefined;
  dataLoading: boolean;
  tableHeaders: string[];
};

export const SafeTxsDataTable = (props: Props) => {
  const { dataSubset, dataLoading, tableHeaders } = props;

  const [tableRows, setSafeTableRows] = useState<Array<SafeTableRow>>([]);
  const ref = useRef(null);

  useEffect(() => {
    if (!dataSubset) return;
    setSafeTableRows(dataSubset);
  }, [dataSubset]);

  return (
    <DataTable>
      <thead>
        <HeaderRow>
          {tableHeaders.map((h, i) => (
            <TableHeader key={h}>
              <InnerDataRow>
                <HeaderTitleContainer>{h}</HeaderTitleContainer>
              </InnerDataRow>
            </TableHeader>
          ))}
        </HeaderRow>
      </thead>
      <tbody>
        {dataLoading ? (
          loadSkeletonRows(1, tableHeaders.length)
        ) : !tableRows || tableRows.length === 0 ? (
          <DataRow hasBorderBotton>
            <DataCell>No data available</DataCell>
          </DataRow>
        ) : (
          <>
            {tableRows.map((row) => {
              return (
                <Fragment key={JSON.stringify(row)}>
                  <DataRow hasBorderBotton={false} ref={ref} key={row.txHash}>
                    <DataCell>
                      <Button
                        isSmall
                        label={
                          row.status === 'awaiting_signing'
                            ? 'SIGN'
                            : row.status === 'executing'
                            ? 'EXECUTING...'
                            : 'EXECUTE'
                        }
                        onClick={row.action}
                        disabled={
                          (row.status === 'awaiting_signing' && row.alreadySigned) ||
                          !row.isOwner ||
                          row.status === 'executing'
                        }
                      />
                    </DataCell>
                    <DataCell>{row.nonce}</DataCell>
                    <DataCell>
                      <LinkStyled href={`${env.etherscan}/tx/${row.txHash}`} target="_blank">
                        {row.txHash.slice(0, 12) + '...'}
                      </LinkStyled>
                    </DataCell>
                    <DataCell>{row.status}</DataCell>
                    <DataCell>{row.confirmations}</DataCell>
                    <DataCell>{row.date}</DataCell>
                  </DataRow>
                </Fragment>
              );
            })}
          </>
        )}
      </tbody>
    </DataTable>
  );
};

const loadSkeletonRows = (skeletonRowsNo: number, skeletonColumnsNo: number) => {
  return [...Array(skeletonRowsNo)].map((_, index) => (
    <DataRow hasBorderBotton key={index}>
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
  padding-top: 0.5rem;
  border-top: 1px solid ${({ theme }) => theme.palette.brand};
`;

const HeaderTitleContainer = styled.div`
  cursor: pointer;
  margin-right: 5px;
`;

const HeaderRow = styled.tr`
  white-space: nowrap;
`;

const InnerDataRow = styled.div`
  display: flex;
  height: 1.5rem;
  font-size: 12px;
`;

const DataTable = styled.table`
  border-collapse: collapse;
  width: 100%;
  color: ${({ theme }) => theme.palette.brand};
`;

const DataRow = styled.tr<{ hasBorderBotton: boolean }>`
  overflow: hidden;
  white-space: nowrap;
  border-top: 1px solid ${({ theme }) => theme.palette.brand};
  ${({ hasBorderBotton, theme }) =>
    `border-bottom: 1px solid ${hasBorderBotton ? theme.palette.brand : theme.palette.dark};`}
`;

const DataCell = styled.td<{ isHidden?: boolean }>`
  position: relative;
  padding-top: 20px;
  padding-right: 10px;
  ${({ isHidden }) => isHidden && 'display: none;'}
  font-size: 13px;
  font-weight: 700;
  text-align: left;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const LinkStyled = styled.a`
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 0.9rem;
  font-weight: 700;
  &:hover {
    color: ${({ theme }) => theme.palette.brandDark};
  }
`;
