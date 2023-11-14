import { useState, useEffect, useMemo } from 'react';
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
import { StrategyKey } from '../hooks/use-dashboardv2-metrics';
import { DropdownCheckOption, RowFilterDropdownProps } from './RowFilterDropdown';

type Props = {
  dashboardType: DashboardType;
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
  orderDesc?: boolean;
  rowFilter?: RowFilterDropdownProps;
};

const TxnHistoryTable = (props: Props) => {
  const { dashboardType, txFilter } = props;
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [blockNumber, setBlockNumber] = useState(0);
  const [rowFilter, setRowFilter] = useState<RowFilter>({});

  const allStrategyDropdowns = useMemo(
    () => [
      { label: StrategyKey.RAMOS, checked: false },
      { label: StrategyKey.TLC, checked: false },
      { label: StrategyKey.TEMPLEBASE, checked: false },
      { label: StrategyKey.DSRBASE, checked: false },
    ],
    []
  );

  const [tableHeaders, setTableHeaders] = useState<TxHistoryTableHeader[]>([
    {
      name: TableHeaders.Date,
      orderDesc: true,
      width: '32%',
    },
    {
      name: TableHeaders.Type,
      orderDesc: undefined,
      width: '13%',
      rowFilter: {
        setRowFilter,
        // TODO: get dropdown values programatically, see https://github.com/TempleDAO/temple/pull/880#discussion_r1386151604
        dropdownOptions: [
          { label: TxType.Borrow, checked: false },
          { label: TxType.Repay, checked: false },
        ],
      },
    },
    {
      name: TableHeaders.Strategy,
      orderDesc: undefined,
      width: '16%',
      rowFilter: {
        setRowFilter,
        // TODO: get dropdown values programatically, see https://github.com/TempleDAO/temple/pull/880#discussion_r1386151604
        dropdownOptions: allStrategyDropdowns,
      },
    },
    {
      name: TableHeaders.Token,
      orderDesc: undefined,
      width: '13%',
      rowFilter: {
        setRowFilter,
        // TODO: get dropdown values programatically, see https://github.com/TempleDAO/temple/pull/880#discussion_r1386151604
        dropdownOptions: [
          { label: DebtToken.DAI, checked: false },
          { label: DebtToken.TEMPLE, checked: false },
        ],
      },
    },
    {
      name: TableHeaders.Amount,
      orderDesc: undefined,
      width: '11%',
    },
    {
      name: TableHeaders.TxHash,
      orderDesc: undefined,
      width: '15%',
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

  const updateRowDropdownCheckbox = (newOption: DropdownCheckOption) => {
    setCurrentPage(1);
    setTableHeaders((prevState) => {
      const newState: TxHistoryTableHeader[] = prevState.map((prevStateHeader) => {
        if (!prevStateHeader.rowFilter) return prevStateHeader;
        const newDropdownOptions = prevStateHeader.rowFilter.dropdownOptions.map((prevOp) => {
          prevOp.checked = false;
          if (prevOp.label === newOption.label) prevOp.checked = newOption.checked;
          return { ...prevOp };
        });
        return {
          ...prevStateHeader,
          rowFilter: {
            setRowFilter: prevStateHeader.rowFilter.setRowFilter,
            dropdownOptions: newDropdownOptions,
          },
        };
      });
      return newState;
    });
  };

  useEffect(() => {
    const selectedStrategy = dashboardTypeToStrategyKey(dashboardType);
    setTableHeaders((prevState) => {
      // When user changes dashboard url:
      //  1. reset page
      setCurrentPage(1);
      //  2. update table strategy dropdown default value
      const newState = prevState.map((prevStateHeader) => {
        if (prevStateHeader.name === TableHeaders.Strategy) {
          return {
            ...prevStateHeader,
            rowFilter: prevStateHeader.rowFilter && {
              setRowFilter: prevStateHeader.rowFilter.setRowFilter,
              dropdownOptions:
                selectedStrategy === StrategyKey.ALL
                  ? allStrategyDropdowns
                  : [{ label: selectedStrategy, checked: true }],
            },
          };
        }
        return prevStateHeader;
      });
      return newState;
    });
  }, [dashboardType, allStrategyDropdowns]);

  useEffect(() => {
    setCurrentPage(1);
  }, [rowsPerPage]);

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
        updateRowDropdownCheckbox={updateRowDropdownCheckbox}
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
