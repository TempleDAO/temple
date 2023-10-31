import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { TxHistoryFilterType } from '.';
import { DashboardType } from '../DashboardContent';
import { format } from 'date-fns';
import { TxnDataTable } from './TxnDataTable';
import { PaginationControl } from './PaginationControl';
import { useTxHistory, useTxHistoryPaginationDefaults } from '../hooks/use-dashboardv2-txHistory';

type Props = {
  dashboardType: DashboardType;
  filter: TxHistoryFilterType;
};

export type TxHistoryTableHeader = {
  name: 'Type' | 'Date' | 'Debt Token' | 'Borrow' | 'Repay' | 'Tx Hash';
  orderDesc?: boolean; 
}

const TxnHistoryTable = ({ dashboardType, filter }: Props) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [tableHeaders, setTableHeaders] = useState<TxHistoryTableHeader[]>([
    {
      name: 'Type',
      orderDesc: undefined,
    },
    {
      name: 'Date',
      orderDesc: true,
    },
    {
      name: 'Debt Token',
      orderDesc: undefined,
    },
    {
      name: 'Borrow',
      orderDesc: undefined,
    },
    {
      name: 'Repay',
      orderDesc: undefined,
    },
    {
      name: 'Tx Hash',
      orderDesc: undefined,
    },
  ]);

  const updateTableHeaders = (currentHeader: TxHistoryTableHeader) => setTableHeaders(prevState => {
    const newState = prevState.map((prevHeader)=>{
      if(prevHeader.name == currentHeader.name){
        return { ...prevHeader, orderDesc: !prevHeader.orderDesc };
      }
      else {
        return { ...prevHeader, orderDesc: undefined};
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

  const isLoading = pagDefault.isLoading || pagDefault.isFetching || txHistory.isLoading || txHistory.isFetching;

  // Fetch strategies tx data
  const dataToTable = txHistory.data?.map((tx) => {
    const amount = Number(Number(tx.amount).toFixed(2));
    return {
      type: tx.type,
      date: format(new Date(Number(tx.timestamp) * 1000), 'yyyy-MM-dd H:mm:ss O'),
      dToken: tx.token.symbol,
      borrow: tx.kind === 'Borrow' ? amount : 0,
      repay: tx.kind === 'Repay' ? amount : 0,
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
