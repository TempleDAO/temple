import { SubGraphResponse } from 'hooks/core/types';
import { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import { fetchGenericSubgraph } from 'utils/subgraph';
import { TxHistoryFilterType } from '.';
import { DashboardType } from '../DashboardContent';
import { format } from 'date-fns';
import { TableRow, TxnDataTable } from './TxnDataTable';
import { PaginationControls } from './TxnPaginationControl';
import env from 'constants/env/local';

type Props = {
  dashboardType: DashboardType;
  filter: TxHistoryFilterType;
};

type StrategyType = 'TlcStrategy' | 'DsrBaseStrategy' | 'RamosStrategy' | 'TempleBaseStrategy' | 'All';

type Transactions = {
  hash: string;
  amount: string;
  amountUsd: string;
  id: string;
  from: string;
  to: string;
  kind: 'Repay' | 'Borrow';
  timestamp: string;
}[];

type StrategyTxns = {
  name: StrategyType;
  id: string;
  transactionCount: number;
  transactions: Transactions;
}[];

type Meta = {
  block: {
    number: number;
  };
};

type FetchTxnsResponse = SubGraphResponse<{ strategies: StrategyTxns; _meta: Meta }>;

const TxnHistoryTable = ({ dashboardType, filter }: Props) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [data, setData] = useState<TableRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [blockNumber, setBlockNumber] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const restartTable = useCallback(async()=> {
    setData([]);
    setCurrentPage(1);
    setBlockNumber(0);
    setRowsPerPage(10);
    setTotalPages(0);
  }, []);
  // Set default values TotalPages & BlockNumber on start
  useEffect(() => {
    (async ()=> {
      await restartTable();
      const strategyType = dashboardTypeToStrategyType(dashboardType);
      const whereQuery = strategyType === 'All' ? `` : `( where: {name: "${strategyType}"} )`;
      const { data: res } = await fetchGenericSubgraph<FetchTxnsResponse>(
        env.subgraph.templeV2,
        `{
            strategies${whereQuery} {
              transactionCount
            }
            _meta {
              block {
                number
              }
            }
          }`
      );
      if (!res) return;
      let txCountTotal = 0;
      res.strategies.map(s=> txCountTotal += s.transactionCount);
      setTotalPages(Math.ceil(txCountTotal / rowsPerPage));
      setBlockNumber(res._meta.block.number);
    })();
  }, [dashboardType, rowsPerPage, restartTable]);

  const fetchTransactions = useCallback(
    async (strategyType: StrategyType): Promise<Transactions> => {
      let whereQuery = ``;
      whereQuery = strategyType === 'All' ? `` : `( where: {name: "${strategyType}"} )`;
      if (blockNumber > 0) {
        whereQuery =
          strategyType === 'All'
            ? `( block: { number: ${blockNumber} } )`
            : `( block: { number: ${blockNumber} } where: {name: "${strategyType}"})`;
      }
      const paginationQuery = `skip: ${(currentPage - 1) * rowsPerPage} first: ${rowsPerPage}`;
      const { data: res } = await fetchGenericSubgraph<FetchTxnsResponse>(
        env.subgraph.templeV2,
        `{
          strategies${whereQuery} {
            name
            id
            transactions(orderBy: timestamp, orderDirection: desc ${paginationQuery}) {
              hash
              amount
              amountUSD
              id
              from
              kind
              timestamp
            }
          }
        }`
      );
      if (!res) return [];
      const txns: Transactions = [];
      for (const strategy of res.strategies) {
        strategy.transactions.map((t) => txns.push(t));
      }
      return txns;
    },
    [blockNumber, currentPage, rowsPerPage]
  );

  // Fetch strategies tx data
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const txns = await fetchTransactions(dashboardTypeToStrategyType(dashboardType));
        // TODO: USE filter
        setData(
          txns.map((tx) => {
            const amount = Number(Number(tx.amount).toFixed(2));
            return {
              date: format(new Date(Number(tx.timestamp) * 1000), 'yyyy-MM-dd'),
              dToken: 'dUsd', // TODO: update dynamically from strategy
              borrow: tx.kind === 'Borrow' ? amount : 0,
              repay: tx.kind === 'Repay' ? amount : 0,
              txHash: tx.id,
            };
          })
        );
      } catch (error) {
        console.error('Error fetching data: ', error);
        // Handle error appropriately
      }
      setIsLoading(false);
    })();
  }, [filter, dashboardType, fetchTransactions]);

  return (
    <TableContainer>
      <PaginationControls totalPages={totalPages} rowsPerPage={rowsPerPage} currentPage={currentPage} setCurrentPage={setCurrentPage} />
        <TxnDataTable dataSubset={data} dataLoading={isLoading}/>
    </TableContainer>
  );
};

const dashboardTypeToStrategyType = (dType: DashboardType) => {
  switch (dType) {
    case DashboardType.TLC:
      return 'TlcStrategy';
    case DashboardType.RAMOS:
      return 'RamosStrategy';
    case DashboardType.DSR_BASE:
      return 'DsrBaseStrategy';
    case DashboardType.TEMPLE_BASE:
      return 'TempleBaseStrategy';
    default:
      return 'All';
  }
};

export default TxnHistoryTable;

const TableContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 70vw;
`;
