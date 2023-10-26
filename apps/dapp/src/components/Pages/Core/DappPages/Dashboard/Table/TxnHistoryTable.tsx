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

const TxnHistoryTable = ({ dashboardType, filter }: Props) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

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
  }, [currentPage, rowsPerPage, filter, dashboardType])

  const isLoading = pagDefault.isLoading || pagDefault.isFetching || txHistory.isLoading || txHistory.isFetching;

  // Fetch strategies tx data
  const dataToTable = txHistory.data?.map((tx) => {
    const amount = Number(Number(tx.amount).toFixed(2));
    return {
      type: tx.type,
      date: format(new Date(Number(tx.timestamp) * 1000), 'yyyy-MM-dd'),
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
      <TxnDataTable dataSubset={dataToTable} dataLoading={isLoading} />
    </TableContainer>
  );
};

export default TxnHistoryTable;

const TableContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 70vw;
`;
