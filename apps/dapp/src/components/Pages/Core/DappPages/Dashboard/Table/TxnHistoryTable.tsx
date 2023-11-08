import { useState } from 'react';
import styled from 'styled-components';
import { TxHistoryFilterType } from '.';
import { DashboardType } from '../DashboardContent';
import { format } from 'date-fns';
import { TableRow, TxType, TxnDataTable } from './TxnDataTable';
import { PaginationControl } from './PaginationControl';
import { RowFilter, useTxHistory, useTxHistoryAvailableRows } from '../hooks/use-dashboardv2-txHistory';
import { useDebouncedCallback } from 'use-debounce';
import { StrategyKey } from '../hooks/use-dashboardv2-metrics';
import { SelectTempleDaoOptions } from 'components/InputSelect/InputSelect';

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
  orderDesc?: boolean;
  filter?: (event: HTMLInputElement) => void;
  dropdownOptions?: SelectTempleDaoOptions;
}

const TxnHistoryTable = ({ dashboardType, txFilter }: Props) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [rowFilter, setRowFilter] = useState<RowFilter>({});

  const [tableHeaders, setTableHeaders] = useState<TxHistoryTableHeader[]>([
    {
      name: TableHeaders.Date,
      orderDesc: true,
    },
    {
      name: TableHeaders.Type,
      orderDesc: undefined,
      filter: useDebouncedCallback(async (event: HTMLInputElement) => {
        setRowFilter(s => ({...s, type: event.value}));
      }, 200),
      // TODO: get the values programatically from subpgrah
      dropdownOptions: [
        { label:'All', value: '' },
        { label: TxType.Borrow, value: TxType.Borrow },
        { label: TxType.Repay, value: TxType.Repay },
      ]
    },
    {
      name: TableHeaders.Strategy,
      orderDesc: undefined,
      filter: useDebouncedCallback(async (event: HTMLInputElement) => {
        setRowFilter(s => ({...s, strategy: event.value}));
      }, 200),
      // TODO: get the values programatically from subpgrah
      dropdownOptions: [
        { label:'All', value: '' },
        { label: StrategyKey.RAMOS, value: StrategyKey.RAMOS },
        { label: StrategyKey.TLC, value: StrategyKey.TLC },
        { label: StrategyKey.TEMPLEBASE, value: StrategyKey.TEMPLEBASE },
        { label: StrategyKey.DSRBASE, value: StrategyKey.DSRBASE },
      ]
    },
    {
      name: TableHeaders.Token,
      orderDesc: undefined,
      filter: useDebouncedCallback(async (event: HTMLInputElement) => {
        setRowFilter(s => ({...s, token: event.value}));
      }, 200),
      // TODO: get the values programatically from subpgrah
      dropdownOptions: [
        { label:'All', value: '' },
        { label: DebtToken.DAI, value: DebtToken.DAI },
        { label: DebtToken.TEMPLE, value: DebtToken.TEMPLE },
      ]
    },
    {
      name: TableHeaders.Amount,
      orderDesc: undefined,
    },
    {
      name: TableHeaders.TxHash,
      orderDesc: undefined,
    },
  ]);

  const updateTableHeadersOrder = (clickedHeader: TxHistoryTableHeader) => setTableHeaders(prevState => {
    const newState = prevState.map((prevStateHeader)=>{
      if(prevStateHeader.name === clickedHeader.name){
        return { ...prevStateHeader, orderDesc: !prevStateHeader.orderDesc };
      }
      else {
        return { ...prevStateHeader, orderDesc: undefined};
      }
    });
    return newState;
  });
  
  const availableRows = useTxHistoryAvailableRows({
    dashboardType,
    txFilter,
    rowFilter
  });

  const txHistory = useTxHistory({
    dashboardType,
    txFilter,
    rowFilter,
    offset: (currentPage -1) * rowsPerPage,
    limit: rowsPerPage,
    blockNumber: availableRows.data?.blockNumber || 0,
    tableHeaders
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

    const totalPages = Math.ceil((availableRows.data?.totalRowCount  || 0) / rowsPerPage);

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
