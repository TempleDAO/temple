import { useState, useEffect } from 'react';
import type * as CSS from 'csstype';
import styled from 'styled-components';
import { TxHistoryFilterType } from '.';
import { DashboardType } from '../DashboardContent';
import { format } from 'date-fns';
import { TableRow, TxType, TxnDataTable } from './TxnDataTable';
import { PaginationControl } from './PaginationControl';
import {
  RowFilter,
  dashboardTypeToStrategyKey,
  useTxHistory,
  useTxHistoryAvailableRows,
} from '../hooks/use-dashboardv2-txHistory';
import { useDebouncedCallback } from 'use-debounce';
import { StrategyKey } from '../hooks/use-dashboardv2-metrics';
import { Option, SelectTempleDaoOptions } from 'components/InputSelect/InputSelect';

type Props = {
  dashboardType: DashboardType;
  txFilter: TxHistoryFilterType;
  selectedStrategy: StrategyKey;
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
  orderDesc?: boolean;
  rowFilter?: {
    filterFn: (event: HTMLInputElement) => void;
    dropdownOptions: SelectTempleDaoOptions;
    defaultValue: Option;
  };
};

const TxnHistoryTable = (props: Props) => {
  const { dashboardType, txFilter, selectedStrategy } = props;
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [blockNumber, setBlockNumber] = useState(0);
  const [rowFilter, setRowFilter] = useState<RowFilter>({});

  const [tableHeaders, setTableHeaders] = useState<TxHistoryTableHeader[]>([
    {
      name: TableHeaders.Date,
      orderDesc: true,
      width: '32.64%',
    },
    {
      name: TableHeaders.Type,
      orderDesc: undefined,
      width: '9.95%',
      rowFilter: {
        filterFn: useDebouncedCallback(async (event: HTMLInputElement) => {
          setRowFilter((s) => ({ ...s, type: event.value }));
        }, 200),
        // TODO: get dropdown values programatically, see https://github.com/TempleDAO/temple/pull/880#discussion_r1386151604
        dropdownOptions: [
          { label: 'All', value: undefined },
          { label: TxType.Borrow, value: TxType.Borrow },
          { label: TxType.Repay, value: TxType.Repay },
        ],
        defaultValue: { label: 'All', value: undefined },
      },
    },
    {
      name: TableHeaders.Strategy,
      orderDesc: undefined,
      width: '16.48%',
      rowFilter: {
        filterFn: useDebouncedCallback(async (event: HTMLInputElement) => {
          setRowFilter((s) => ({ ...s, strategy: event.value }));
        }, 200),
        // TODO: get dropdown values programatically, see https://github.com/TempleDAO/temple/pull/880#discussion_r1386151604
        dropdownOptions: [
          { label: 'All', value: undefined },
          { label: StrategyKey.RAMOS, value: StrategyKey.RAMOS },
          { label: StrategyKey.TLC, value: StrategyKey.TLC },
          { label: StrategyKey.TEMPLEBASE, value: StrategyKey.TEMPLEBASE },
          { label: StrategyKey.DSRBASE, value: StrategyKey.DSRBASE },
        ],
        defaultValue: { label: selectedStrategy, value: selectedStrategy },
      },
    },
    {
      name: TableHeaders.Token,
      orderDesc: undefined,
      width: '10.87%',
      rowFilter: {
        filterFn: useDebouncedCallback(async (event: HTMLInputElement) => {
          setRowFilter((s) => ({ ...s, token: event.value }));
        }, 200),
        // TODO: get dropdown values programatically, see https://github.com/TempleDAO/temple/pull/880#discussion_r1386151604
        dropdownOptions: [
          { label: 'All', value: undefined },
          { label: DebtToken.DAI, value: DebtToken.DAI },
          { label: DebtToken.TEMPLE, value: DebtToken.TEMPLE },
        ],
        defaultValue: { label: 'All', value: undefined },
      },
    },
    {
      name: TableHeaders.Amount,
      orderDesc: undefined,
      width: '12.93%',
    },
    {
      name: TableHeaders.TxHash,
      orderDesc: undefined,
      width: '17.13%',
    },
  ]);

  const updateTableHeadersOrder = (clickedHeader: TxHistoryTableHeader) =>
    setTableHeaders((prevState) => {
      const newState = prevState.map((prevStateHeader) => {
        if (prevStateHeader.name === clickedHeader.name) {
          return { ...prevStateHeader, orderDesc: !prevStateHeader.orderDesc };
        } else {
          return { ...prevStateHeader, orderDesc: undefined };
        }
      });
      return newState;
    });

  useEffect(() => {
    const selectedStrategy = dashboardTypeToStrategyKey(dashboardType);
    setTableHeaders((prevState) => {
      const newState = prevState.map((prevStateHeader) => {
        if (prevStateHeader.name === TableHeaders.Strategy) {
          // When user changes dashboard url:
          //  1. reset page
          setCurrentPage(1);
          //  2. update table strategy dropdown default value
          return {
            ...prevStateHeader,
            rowFilter: prevStateHeader.rowFilter && {
              filterFn: prevStateHeader.rowFilter.filterFn,
              dropdownOptions: prevStateHeader.rowFilter.dropdownOptions,
              defaultValue: { label: selectedStrategy, value: selectedStrategy },
            },
          };
        }
        return prevStateHeader;
      });
      return newState;
    });
  }, [dashboardType]);

  const availableRows = useTxHistoryAvailableRows({
    dashboardType,
    txFilter,
    rowFilter,
  });

  // Only change the blockNumber when the page is refreshed
  // it ensures consistency in subsequent pagination queries results
  if (blockNumber === 0 && availableRows.data) setBlockNumber(availableRows.data.blockNumber);

  const txHistory = useTxHistory({
    dashboardType,
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
    const amount = Number(Number(tx.amount).toFixed(2));
    return {
      date: format(new Date(Number(tx.timestamp) * 1000), 'yyyy-MM-dd H:mm:ss O'),
      type: tx.name,
      strategy: tx.strategy.name,
      token: tx.token.symbol,
      amount: amount,
      txHash: tx.hash,
    };
  });

  const totalPages = Math.ceil((availableRows.data?.totalRowCount || 0) / rowsPerPage);

  return (
    <TableContainer>
      <PaginationControl
        totalPages={totalPages}
        rowsPerPage={rowsPerPage}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        setRowsPerPage={setRowsPerPage}
      />
      <TxnDataTable
        dataSubset={dataToTable}
        dataLoading={isLoading}
        dataRefetching={isRefetching}
        tableHeaders={tableHeaders}
        updateTableHeadersOrder={updateTableHeadersOrder}
      />
    </TableContainer>
  );
};

export default TxnHistoryTable;

const TableContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 70vw;
`;
