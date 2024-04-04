import { useState, useEffect, useMemo } from 'react';
import type * as CSS from 'csstype';
import styled from 'styled-components';
import { TxHistoryFilterType } from '.';
import { format } from 'date-fns';
import { TableRow, TxType, TxnDataTable } from './TxnDataTable';
import { PaginationControl } from './PaginationControl';
import {
  RowFilter,
  useTxHistory,
  useTxHistoryAvailableRows,
} from '../hooks/use-dashboardv2-txHistory';
import { DropdownCheckOption, DropdownCheckOptions } from './RowFilterDropdown';
import { useMediaQuery } from 'react-responsive';
import { queryMinTablet } from 'styles/breakpoints';
import env from 'constants/env';
import linkSvg from 'assets/icons/link.svg?react';
import { formatNumberWithCommas } from 'utils/formatter';
import { DashboardData, Dashboards, isTRVDashboard } from '../DashboardConfig';

type Props = {
  dashboardData: DashboardData;
  txFilter: TxHistoryFilterType;
};

export enum TableHeaders {
  Date = 'Date',
  Type = 'Type',
  Strategy = 'Strategy',
  Token = 'Token',
  Amount = 'Amount',
  TxHash = 'Tx Hash',
}

enum DebtToken {
  DAI = 'DAI',
  TEMPLE = 'TEMPLE',
}

export type TxHistoryTableHeader = {
  name: TableHeaders;
  width: CSS.Property.Width;
  isHidden: boolean;
  orderDesc?: boolean;
  dropdownOptions?: DropdownCheckOptions;
};

const TxnHistoryTable = (props: Props) => {
  const { dashboardData, txFilter } = props;
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [blockNumber, setBlockNumber] = useState(0);
  const [rowFilter, setRowFilter] = useState<RowFilter>({});
  const isBiggerThanTablet = useMediaQuery({ query: queryMinTablet });

  const allStrategyDropdowns = useMemo(
    () =>
      Dashboards.map((dashboard) => ({ label: dashboard.key, checked: false })),
    []
  );

  // Show/hide/resize table columns automatically when screen is resized
  useEffect(() => {
    setTableHeaders((prevTableHeaders) => {
      return prevTableHeaders.map((th) => {
        switch (th.name) {
          case TableHeaders.Date:
            return { ...th, width: isBiggerThanTablet ? '245px' : '107px' };
          case TableHeaders.Token:
            return { ...th, width: isBiggerThanTablet ? '100px' : '99px' };
          case TableHeaders.Amount:
            return { ...th, width: isBiggerThanTablet ? '97px' : '128px' };
          case TableHeaders.Type:
          case TableHeaders.Strategy:
          case TableHeaders.TxHash:
            return {
              ...th,
              width: isBiggerThanTablet ? '128px' : '99px',
              isHidden: !isBiggerThanTablet,
            };
          default:
            return th;
        }
      });
    });
  }, [isBiggerThanTablet]);

  const [tableHeaders, setTableHeaders] = useState<TxHistoryTableHeader[]>([
    {
      name: TableHeaders.Date,
      orderDesc: true,
      width: isBiggerThanTablet ? '245px' : '107px',
      isHidden: false,
    },
    {
      name: TableHeaders.Type,
      orderDesc: undefined,
      width: '93px',
      isHidden: isBiggerThanTablet ? false : true,
      // TODO: get dropdown values programatically, see https://github.com/TempleDAO/temple/pull/880#discussion_r1386151604
      dropdownOptions: [
        { label: TxType.Borrow, checked: false },
        { label: TxType.Repay, checked: false },
      ],
    },
    {
      name: TableHeaders.Strategy,
      orderDesc: undefined,
      width: '123px',
      isHidden: isBiggerThanTablet ? false : true,
      // TODO: get dropdown values programatically, see https://github.com/TempleDAO/temple/pull/880#discussion_r1386151604
      dropdownOptions: allStrategyDropdowns,
    },
    {
      name: TableHeaders.Token,
      orderDesc: undefined,
      width: isBiggerThanTablet ? '100px' : '99px',
      isHidden: false,
      // TODO: get dropdown values programatically, see https://github.com/TempleDAO/temple/pull/880#discussion_r1386151604
      dropdownOptions: [
        { label: DebtToken.DAI, checked: false },
        { label: DebtToken.TEMPLE, checked: false },
      ],
    },
    {
      name: TableHeaders.Amount,
      orderDesc: undefined,
      width: isBiggerThanTablet ? '97px' : '128px',
      isHidden: false,
    },
    {
      name: TableHeaders.TxHash,
      orderDesc: undefined,
      width: isBiggerThanTablet ? '128px' : '99px',
      isHidden: isBiggerThanTablet ? false : true,
    },
  ]);

  const updateTableHeadersOrder = (clickedHeader: TxHistoryTableHeader) =>
    setTableHeaders((prevState) => {
      const newState = prevState.map((prevStateHeader) => {
        if (prevStateHeader.name === clickedHeader.name) {
          return { ...prevStateHeader, orderDesc: !prevStateHeader.orderDesc };
        }
        return { ...prevStateHeader, orderDesc: undefined };
      });
      return newState;
    });

  const updateRowDropdownCheckbox = (
    clickedHeader: TableHeaders,
    newOption: DropdownCheckOption
  ) => {
    setCurrentPage(1);
    setTableHeaders((prevState) => {
      const newState: TxHistoryTableHeader[] = prevState.map(
        (prevStateHeader) => {
          // if table header with no filters, do nothing
          if (!prevStateHeader.dropdownOptions) return prevStateHeader;
          // if prevState is not the table header clicked, do nothing
          if (clickedHeader !== prevStateHeader.name) return prevStateHeader;
          const newDropdownOptions = prevStateHeader.dropdownOptions.map(
            (prevOp) => {
              prevOp.checked = false;
              if (prevOp.label === newOption.label)
                prevOp.checked = newOption.checked;
              return { ...prevOp };
            }
          );
          return {
            ...prevStateHeader,
            dropdownOptions: newDropdownOptions,
          };
        }
      );
      return newState;
    });
  };

  useEffect(() => {
    const selectedStrategy = dashboardData.key;
    setTableHeaders((prevState) => {
      // When user changes dashboard url:
      //  1. reset page
      setCurrentPage(1);
      //  2. reset row filters
      setRowFilter((s) => ({ ...s, type: undefined }));
      setRowFilter((s) => ({ ...s, strategy: undefined }));
      setRowFilter((s) => ({ ...s, token: undefined }));
      //  3. update table dropdown value & reset column sorting to default Date orderDesc
      const newState = prevState.map((prevStateHeader) => {
        //  3.1 set default strategy dropdown depending on selected dashboard
        if (prevStateHeader.name === TableHeaders.Strategy) {
          if (!prevStateHeader.dropdownOptions)
            return { ...prevStateHeader, orderDesc: undefined };
          return {
            ...prevStateHeader,
            orderDesc: undefined,
            dropdownOptions: isTRVDashboard(selectedStrategy)
              ? allStrategyDropdowns
              : [{ label: selectedStrategy, checked: true }],
          };
        }
        //  3.2 reset all other dropdown values
        if (!prevStateHeader.dropdownOptions)
          return {
            ...prevStateHeader,
            orderDesc:
              TableHeaders.Date === prevStateHeader.name ? true : undefined,
          };
        const newDropdownOptions = prevStateHeader.dropdownOptions.map(
          (prevOp) => {
            return { ...prevOp, checked: false };
          }
        );
        return {
          ...prevStateHeader,
          orderDesc:
            TableHeaders.Date === prevStateHeader.name ? true : undefined,
          dropdownOptions: newDropdownOptions,
        };
      });
      return newState;
    });
  }, [dashboardData.key, allStrategyDropdowns]);

  useEffect(() => {
    setCurrentPage(1);
  }, [rowsPerPage]);

  const availableRows = useTxHistoryAvailableRows({
    dashboardData,
    txFilter,
    rowFilter,
  });

  // Only change the blockNumber when the page is refreshed
  // it ensures consistency in subsequent pagination queries results
  if (blockNumber === 0 && availableRows.data)
    setBlockNumber(availableRows.data.blockNumber);

  const txHistory = useTxHistory({
    dashboardData,
    txFilter,
    rowFilter,
    offset: (currentPage - 1) * rowsPerPage,
    limit: rowsPerPage,
    blockNumber,
    tableHeaders,
  });

  const isLoading = availableRows.isLoading || txHistory.isLoading;
  const isRefetching = availableRows.isRefetching || txHistory.isRefetching;

  // Fetch strategies tx data
  const dataToTable: TableRow[] | undefined = txHistory.data?.map((tx) => {
    const amountResponsive = isBiggerThanTablet
      ? tx.amount
      : tx.name === TxType.Borrow
      ? Number(tx.amount) * -1
      : tx.amount;
    const amountFmt = formatNumberWithCommas(amountResponsive);
    const datetime = format(
      new Date(Number(tx.timestamp) * 1000),
      'yyyy-MM-dd H:mm:ss O'
    );
    const dateOnly = format(
      new Date(Number(tx.timestamp) * 1000),
      'yyyy-MM-dd'
    );
    const timeOnly = format(new Date(Number(tx.timestamp) * 1000), 'H:mm:ss');
    return {
      date: isBiggerThanTablet ? datetime : dateOnly,
      type: tx.name,
      strategy: tx.strategy.name,
      token: tx.token.symbol,
      amount: amountFmt,
      txHash: tx.hash,
      expRowMobView: {
        isOpen: false,
        component: (
          <>
            <DataCell>
              <ColText lightColor={false}>Time</ColText>
              <ColText lightColor>{timeOnly}</ColText>
            </DataCell>
            <DataCell>
              <ColText lightColor={false}>Strategy</ColText>
              <ColText lightColor>{tx.strategy.name}</ColText>
            </DataCell>
            <DataCell>
              <ColText lightColor={false}>Type</ColText>
              <FlexContainer>
                <ColText lightColor style={{ flexGrow: 1 }}>
                  {tx.name}
                </ColText>
                <LinkIcon
                  onClick={() =>
                    window.open(`${env.etherscan}/tx/${tx.hash}`, '_blank')
                  }
                />
              </FlexContainer>
            </DataCell>
          </>
        ),
      },
    };
  });

  const totalPages = Math.ceil(
    (availableRows.data?.totalRowCount || 0) / rowsPerPage
  );

  return (
    <TableContainer>
      <TxnDataTable
        dataSubset={dataToTable}
        dataLoading={isLoading}
        dataRefetching={isRefetching}
        tableHeaders={tableHeaders}
        setRowFilter={setRowFilter}
        updateTableHeadersOrder={updateTableHeadersOrder}
        updateRowDropdownCheckbox={updateRowDropdownCheckbox}
      />
      <PaginationControl
        totalPages={totalPages}
        rowsPerPage={rowsPerPage}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        setRowsPerPage={setRowsPerPage}
      />
    </TableContainer>
  );
};

export default TxnHistoryTable;

const TableContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const DataCell = styled.td`
  padding: 0;
  padding-bottom: 20px;
  font-size: 12px;
  font-weight: 700;
  background-color: ${({ theme }) => theme.palette.dark};
`;

const FlexContainer = styled.div`
  display: flex;
  padding-right: 5px;
`;

const LinkIcon = styled(linkSvg)`
  fill: ${({ theme }) => theme.palette.brandLight};
  cursor: pointer;
  width: 15px;
`;

const ColText = styled.div<{ lightColor: boolean }>`
  display: flex;
  flex-direction: row;
  padding-top: 5px;
  color: ${({ theme, lightColor }) =>
    lightColor ? theme.palette.brandLight : theme.palette.brand};
`;
