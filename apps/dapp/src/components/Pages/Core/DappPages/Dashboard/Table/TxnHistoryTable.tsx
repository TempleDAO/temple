import { useEffect, useState, FormEvent } from 'react';
import styled from 'styled-components';
import { TxHistoryFilterType } from '.';
import { DashboardType } from '../DashboardContent';
import { format } from 'date-fns';
import { TableRow, TxType, TxnDataTable } from './TxnDataTable';
import { PaginationControl } from './PaginationControl';
import { RowFilter, useTxHistory, useTxHistoryPaginationDefaults } from '../hooks/use-dashboardv2-txHistory';
import { useDebouncedCallback } from 'use-debounce';

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

export type TxHistoryTableHeader = {
  name: TableHeaders;
  orderDesc?: boolean;
  filter?: (event: FormEvent<HTMLInputElement>) => void;  
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
      filter: useDebouncedCallback(async (event: FormEvent<EventTarget>) => {
        const target = event.target as HTMLInputElement;
        // only set row filter type if value is 'Borrow' or 'Repay'
        // subgraph only accept the exact value for this property
        if (target.value.includes(TxType.Borrow) || target.value.includes(TxType.Repay) || target.value.length === 0 ){
          setRowFilter(s => ({...s, type: target.value}));
        }
      }, 500)
    },
    {
      name: TableHeaders.Strategy,
      orderDesc: undefined,
      filter: useDebouncedCallback(async (event: FormEvent<EventTarget>) => {
        const target = event.target as HTMLInputElement;
        setRowFilter(s => ({...s, strategy: target.value}));
      }, 500)
    },
    {
      name: TableHeaders.Token,
      orderDesc: undefined,
      filter: useDebouncedCallback(async (event: FormEvent<EventTarget>) => {
        const target = event.target as HTMLInputElement;
        setRowFilter(s => ({...s, token: target.value}));
      }, 500)
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

  const updateTableHeaders = (clickedHeader: TxHistoryTableHeader) => setTableHeaders(prevState => {
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
  
  const pagDefault = useTxHistoryPaginationDefaults(
    dashboardType,
    rowsPerPage,
    txFilter
  );

  const txHistory = useTxHistory({
    dashboardType,
    txFilter,
    rowFilter,
    currentPage,
    rowsPerPage,
    blockNumber: pagDefault.data?.blockNumber || 0,
    tableHeaders
  });
  
  // when user changes rowsPerPage or filters, refetch pagination defaults
  useEffect(()=> {
    pagDefault.refetch();
    // restart to page one when changing amount of pages
    setCurrentPage(1);
  }, [rowsPerPage, txFilter, rowFilter, dashboardType])
  
  // when user changes currentPage, rowsPerPage or filters, refetch txns
  useEffect(()=> {
    txHistory.refetch();
  }, [currentPage, rowsPerPage, txFilter, rowFilter, dashboardType, tableHeaders])

  const isLoading = pagDefault.isLoading || txHistory.isLoading;
  const isRefetching = pagDefault.isRefetching || txHistory.isRefetching;

  // Fetch strategies tx data
  const dataToTable: TableRow[] | undefined = txHistory.data?.map((tx) => {
      const amount = Number(Number(tx.amount).toFixed(2));
      return {
        date: format(new Date(Number(tx.timestamp) * 1000), 'yyyy-MM-dd H:mm:ss O'),
        type: tx.kind,
        strategy: tx.strategy.name,
        token: tx.token.symbol,
        amount: amount,
        txHash: tx.hash,
      };
    });

  return (
    <TableContainer>
      <PaginationControl
        totalPages={pagDefault.data?.totalPages || 0}
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
        updateTableHeaders={updateTableHeaders}
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
