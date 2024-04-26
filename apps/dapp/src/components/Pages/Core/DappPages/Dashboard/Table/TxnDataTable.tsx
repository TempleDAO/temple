import {
  ReactNode,
  useState,
  useEffect,
  useRef,
  SetStateAction,
  Fragment,
} from 'react';
import { LoadingText } from 'components/Pages/Core/components/LoaderVault/commons/LoadingText';
import env from 'constants/env';
import styled from 'styled-components';
import { loading } from 'utils/loading-value';
import { ArrowButtonUpDown } from 'components/Pages/Ascend/components/Trade/styles';
import { TxHistoryTableHeader } from './TxnHistoryTable';
import { useMediaQuery } from 'react-responsive';
import * as breakpoints from 'styles/breakpoints';
import { queryMinTablet, queryPhone } from 'styles/breakpoints';
import dropdownIcon from 'assets/icons/dropdown.svg?react';
import {
  RowFilterDropdown,
  updateRowDropdownCheckbox,
} from './RowFilterDropdown';
import { RowFilter } from '../hooks/use-dashboardv2-txHistory';
import { StrategyKey } from '../DashboardConfig';

export enum TxType {
  Borrow = 'Borrow',
  Repay = 'Repay',
}

export type TableRow = {
  date: string;
  type: TxType;
  strategy?: StrategyKey;
  token: string;
  amount: string;
  txHash: string;
  expRowMobView: {
    isOpen: boolean;
    component: ReactNode;
  };
};

type Props = {
  dataSubset: TableRow[] | undefined;
  dataLoading: boolean;
  dataRefetching: boolean;
  tableHeaders: TxHistoryTableHeader[];
  setRowFilter: (rowFilter: SetStateAction<RowFilter>) => void;
  updateTableHeadersOrder: (currentHeader: TxHistoryTableHeader) => void;
  updateRowDropdownCheckbox: updateRowDropdownCheckbox;
};

export const TxnDataTable = (props: Props) => {
  const {
    dataSubset,
    dataLoading,
    dataRefetching,
    tableHeaders,
    setRowFilter,
    updateTableHeadersOrder,
    updateRowDropdownCheckbox,
  } = props;

  const [tableRows, setTableRows] = useState<Array<TableRow>>([]);
  const ref = useRef(null);
  const isBiggerThanTablet = useMediaQuery({ query: queryMinTablet });
  const isBiggerThanPhone = useMediaQuery({ query: queryPhone });

  useEffect(() => {
    if (!dataSubset) return;
    setTableRows(dataSubset);
  }, [dataSubset]);

  const clickTableRow = (row?: TableRow) => {
    setTableRows((prevRows) =>
      prevRows?.map((r) => {
        const emv = r.expRowMobView;
        if (r == row) {
          return {
            ...r,
            expRowMobView: { isOpen: !emv.isOpen, component: emv.component },
          };
        }
        return r;
      })
    );
  };
  return (
    <DataTable isBiggerThanTablet={isBiggerThanPhone}>
      <thead>
        <HeaderRow>
          {tableHeaders.map((h, i) => (
            <TableHeader
              key={h.name}
              isHidden={h.isHidden}
              style={
                isBiggerThanPhone ? { width: h.width } : { minWidth: h.width }
              }
            >
              <InnerDataRow>
                <HeaderTitleContainer
                  onClick={() => updateTableHeadersOrder(h)}
                >
                  {h.name}
                </HeaderTitleContainer>
                {h.dropdownOptions && (
                  <RowFilterDropdown
                    name={h.name}
                    dropdownOptions={h.dropdownOptions}
                    setRowFilter={setRowFilter}
                    updateRowDropdownCheckbox={updateRowDropdownCheckbox}
                  />
                )}
                {h.orderDesc !== undefined ? (
                  <ArrowButtonUpDown
                    clicked={h.orderDesc}
                    onClick={() => updateTableHeadersOrder(h)}
                  />
                ) : (
                  <EmptySpace />
                )}
              </InnerDataRow>
            </TableHeader>
          ))}
        </HeaderRow>
      </thead>
      <tbody>
        {dataLoading ? (
          loadSkeletonRows(
            1,
            tableHeaders.filter((h) => h.isHidden === false).length
          )
        ) : !tableRows || tableRows.length === 0 ? (
          <DataRow hasBorderBotton>
            <DataCell>No data available</DataCell>
          </DataRow>
        ) : (
          <>
            {dataRefetching &&
              loadSkeletonRows(
                1,
                tableHeaders.filter((h) => h.isHidden === false).length
              )}
            {tableRows.map((row) => {
              // deconstruct so we can remove expRowMobView, and then use rowData as key of the Fragment
              const { expRowMobView, ...rowData } = row;
              return (
                <Fragment key={JSON.stringify(rowData)}>
                  <DataRow
                    hasBorderBotton={false}
                    ref={ref}
                    key={row.token + row.txHash}
                    onClick={() => clickTableRow(row)}
                  >
                    <DataCell isHidden={tableHeaders[0].isHidden}>
                      {row.date}
                    </DataCell>
                    <DataCell isHidden={tableHeaders[1].isHidden}>
                      {row.type}
                    </DataCell>
                    <DataCell isHidden={tableHeaders[2].isHidden}>
                      {row.strategy}
                    </DataCell>
                    <DataCell isHidden={tableHeaders[3].isHidden}>
                      {row.token}
                    </DataCell>
                    <DataCell isHidden={tableHeaders[4].isHidden}>
                      <FlexContainer>
                        {row.amount}{' '}
                        {!isBiggerThanTablet &&
                          (row.expRowMobView.isOpen ? (
                            <ArrowUp />
                          ) : (
                            <ArrowDown />
                          ))}
                      </FlexContainer>
                    </DataCell>
                    <DataCell isHidden={tableHeaders[5].isHidden}>
                      <LinkStyled
                        href={`${env.etherscan}/tx/${row.txHash}`}
                        target="_blank"
                      >
                        {row.txHash.slice(0, 12) + '...'}
                      </LinkStyled>
                    </DataCell>
                  </DataRow>
                  <DataRow hasBorderBotton onClick={() => clickTableRow(row)}>
                    {row.expRowMobView.isOpen &&
                      !isBiggerThanTablet &&
                      row.expRowMobView.component}
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

const loadSkeletonRows = (
  skeletonRowsNo: number,
  skeletonColumnsNo: number
) => {
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

const TableHeader = styled.th<{ isHidden: boolean }>`
  vertical-align: top;
  text-align: left;
  ${({ isHidden }) => isHidden && 'display: none;'}
`;

const ArrowDown = styled(dropdownIcon)`
  fill: ${({ theme }) => theme.palette.brand};
`;

const FlexContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ArrowUp = styled(dropdownIcon)`
  fill: ${({ theme }) => theme.palette.brand};
  transform: rotate(180deg);
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

const EmptySpace = styled.p`
  width: 1rem;
`;

const DataTable = styled.table<{ isBiggerThanTablet: boolean }>`
  margin-top: 5px;
  border-collapse: collapse;
  table-layout: ${({ isBiggerThanTablet }) =>
    isBiggerThanTablet ? 'fixed' : ''};
  width: 100%;
  color: ${({ theme }) => theme.palette.brand};
`;

const DataRow = styled.tr<{ hasBorderBotton: boolean }>`
  overflow: hidden;
  white-space: nowrap;
  border-top: 1px solid ${({ theme }) => theme.palette.brand};
  ${({ hasBorderBotton, theme }) =>
    `border-bottom: 1px solid ${
      hasBorderBotton ? theme.palette.brand : theme.palette.dark
    };`}
`;

const DataCell = styled.td<{ isHidden?: boolean }>`
  position: relative;
  padding: 20px 0;
  ${({ isHidden }) => isHidden && 'display: none;'}
  font-size: 13px;
  font-weight: 700;
  text-align: left;
  color: ${({ theme }) => theme.palette.brandLight};
  text-align-last: justify;
  ${breakpoints.tabletAndAbove(`
    text-align-last: auto;
  `)};
`;

const LinkStyled = styled.a`
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 0.9rem;
  font-weight: 700;
  &:hover {
    color: ${({ theme }) => theme.palette.brandDark};
  }
`;
