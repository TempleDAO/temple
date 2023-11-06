import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { TxHistoryFilterType } from '.';
import { DashboardType } from '../DashboardContent';
import { format } from 'date-fns';
import { TableRow, TxnDataTable } from './TxnDataTable';
import { PaginationControl } from './PaginationControl';
import { useTxHistory, useTxHistoryPaginationDefaults } from '../hooks/use-dashboardv2-txHistory';

type Props = {
  dashboardType: DashboardType;
  filter: TxHistoryFilterType;
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
}

const TxnHistoryTable = ({ dashboardType, filter }: Props) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [tableHeaders, setTableHeaders] = useState<TxHistoryTableHeader[]>([
    {
      name: TableHeaders.Date,
      orderDesc: true,
    },
    {
      name: TableHeaders.Type,
      orderDesc: undefined,
    },
    {
      name: TableHeaders.Strategy,
      orderDesc: undefined,
    },
    {
      name: TableHeaders.Token,
      orderDesc: undefined,
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
    filter
  );

  const txHistory = useTxHistory({
    dashboardType,
    filter,
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
  }, [rowsPerPage, filter, dashboardType])
  
  // when user changes currentPage, rowsPerPage or filters, refetch txns
  useEffect(()=> {
    txHistory.refetch();
  }, [currentPage, rowsPerPage, filter, dashboardType, tableHeaders])

  const isLoading = pagDefault.isLoading || txHistory.isLoading;

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
