import { fetchGenericSubgraph } from 'utils/subgraph';
import env from 'constants/env';
import { SubGraphResponse } from 'hooks/core/types';
import { useApiQuery, getQueryKey } from 'hooks/api/use-react-query';
import { TxHistoryFilterType } from '../Table';
import { DashboardType } from '../DashboardContent';
import { StrategyKey } from './use-dashboardv2-metrics';
import { TableHeaders, TxHistoryTableHeader } from '../Table/TxnHistoryTable';
import { TxType } from '../Table/TxnDataTable';

type Transactions = {
  hash: string;
  strategy: {
    id: string;
    name: StrategyKey;
  };
  token: {
    id: string;
    name: string;
    symbol: string;
  };
  amount: string;
  amountUsd: string;
  id: string;
  from: string;
  to: string;
  kind: TxType;
  timestamp: string;
}[];

type PaginationDefaults = {
  totalPages: number;
  totalTransactionCount: number;
  blockNumber: number;
};

type Metrics = {
  strategyTransactionCount: number;
}[];

type Meta = {
  block: {
    number: number;
  };
};

type FetchTxnsResponse = SubGraphResponse<{ 
  strategyTransactions: Transactions;
  metrics: Metrics;
  _meta: Meta 
}>;

type Props = {
  dashboardType: DashboardType;
  filter: TxHistoryFilterType;
  currentPage: number;
  rowsPerPage: number;
  blockNumber: number;
  tableHeaders: TxHistoryTableHeader[];
};

const txHistoryFilterTypeToSeconds = (filter: TxHistoryFilterType) => {
  const dateNowSecs = Math.round(Date.now() / 1000);
  const oneDaySecs = 86400;
  switch (filter) {
    case 'all':
      return dateNowSecs;
    case 'last30days':
      return oneDaySecs * 30;
    case 'lastweek':
      return oneDaySecs * 7;
  }
};

const dashboardTypeToStrategyKey = (dType: DashboardType): StrategyKey => {
  switch (dType) {
    case DashboardType.TLC:
      return StrategyKey.TLC;
    case DashboardType.RAMOS:
      return StrategyKey.RAMOS;
    case DashboardType.DSR_BASE:
      return StrategyKey.DSRBASE;
    case DashboardType.TEMPLE_BASE:
      return StrategyKey.TEMPLEBASE;
    default:
      return StrategyKey.ALL;
  }
};

const getTableHeaderOrderByType = (tableHeader?: TxHistoryTableHeader) => {
  if (!tableHeader) return 'timestamp';
  switch(tableHeader.name){
    case 'Date':
      return 'timestamp';
    case TableHeaders.Strategy:
      return 'strategy__name';
    case TableHeaders.Type:
      return 'kind';
    case TableHeaders.Token:
      return 'token__name';
    case TableHeaders.Amount:
      return 'amount';
    case TableHeaders.TxHash:
      return 'hash';
  }
}

const useTxHistory = (props: Props) =>
  useApiQuery<Transactions>(getQueryKey.txHistory(), () => {
    return fetchTransactions(props);
  });

const fetchTransactions = async (props: Props): Promise<Transactions> => {
  const { dashboardType, blockNumber, currentPage, rowsPerPage, filter, tableHeaders } = props;
  const strategyKey = dashboardTypeToStrategyKey(dashboardType);
  const strategyQuery = strategyKey === StrategyKey.ALL ? `` : `strategy_: {name: "${strategyKey}"}`;
  const blockNumberQueryParam = blockNumber > 0 ? `block: { number: ${blockNumber} }` : ``;

  const paginationQuery = `skip: ${(currentPage - 1) * rowsPerPage} first: ${rowsPerPage}`;

  const dateNowSecs = Math.round(Date.now() / 1000);
  const whereQuery = `${blockNumberQueryParam} where: { ${strategyQuery} timestamp_gt: ${dateNowSecs - txHistoryFilterTypeToSeconds(filter)} }`;
  const orderHeader = tableHeaders.find(h => h.orderDesc !== undefined);
  
  // set default ordering
  const orderBy =  getTableHeaderOrderByType(tableHeaders.find(h=>h.orderDesc!==undefined));
  const orderType = orderHeader ? orderHeader.orderDesc ? 'desc' : 'asc' : 'desc';

  const subgraphQuery = `{
    strategyTransactions(orderBy: ${orderBy}, orderDirection: ${orderType} ${paginationQuery} ${whereQuery}) {
      hash
      strategy {
        id
        name
      }
      token {
        id
        name
        symbol
      }
      amount
      amountUSD
      id
      from
      kind
      timestamp
    }
  }`;

  const { data: res } = await fetchGenericSubgraph<FetchTxnsResponse>(env.subgraph.templeV2, subgraphQuery);
  if (!res) return [];
  return res.strategyTransactions;
};

const useTxHistoryPaginationDefaults = (
  dashboardType: DashboardType,
  rowsPerPage: number,
  filter: TxHistoryFilterType
) =>
  useApiQuery<PaginationDefaults>(getQueryKey.txPagDefault(), async () => {
    return fetchPaginationDefaults(dashboardType, rowsPerPage, filter);
  });
const fetchPaginationDefaults = async (
  dashboardType: DashboardType,
  rowsPerPage: number,
  filter: TxHistoryFilterType
) => {
  const strategyKey = dashboardTypeToStrategyKey(dashboardType);
  const strategyQuery = strategyKey === StrategyKey.ALL ? `` : `strategy_: {name: "${strategyKey}"}`;
  const dateNowSecs = Math.round(Date.now() / 1000);
  // get the max allowed 1000 records for a more accurate totalPages calculation
  const whereQuery = `( first: 1000 where: { ${strategyQuery} timestamp_gt: ${dateNowSecs - txHistoryFilterTypeToSeconds(filter)} } )`;
  const subgraphQuery = `{
    metrics {
      strategyTransactionCount
    }
    strategyTransactions${whereQuery} {
      hash
    }
    _meta {
      block {
        number
      }
    }
  }`;
  const { data: res } = await fetchGenericSubgraph<FetchTxnsResponse>(env.subgraph.templeV2, subgraphQuery);

  let pagDefaults: PaginationDefaults = {
    totalPages: 0,
    blockNumber: 0,
    totalTransactionCount: 0,
  };
  if (res) {
    let txCountTotal = 0;
    if (filter === 'all' && strategyKey === StrategyKey.ALL) {
      // if user chooses all transactions sum the txCountTotal of every strategy, we don't use this
      // calc for the last30days or lastweek filters because it could show an incorrect number
      // of totalPages, e.g. only 3 txs last week, but a total of 10000 txs in total
      txCountTotal = res.metrics[0].strategyTransactionCount;
    } else {
      // if user chooses last30days or lastweek filters, count the length of txs of each strategy
      // in this case there maybe a chance of incorrect calc if there are more than 1000 records,
      // which is unlikely in foreseeable future. This due to the max 1000 records subgraph limitation
      txCountTotal = res.strategyTransactions.length;
    }
    pagDefaults = {
      totalPages: Math.ceil(txCountTotal / rowsPerPage),
      blockNumber: res._meta.block.number,
      totalTransactionCount: txCountTotal
    };
  }
  return pagDefaults;
};

export { useTxHistory, useTxHistoryPaginationDefaults };
