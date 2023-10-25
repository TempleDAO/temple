import { fetchGenericSubgraph } from 'utils/subgraph';
import env from 'constants/env';
import { SubGraphResponse } from 'hooks/core/types';
import { useApiQuery, getQueryKey, StrategyKey } from 'hooks/api/use-react-query';
import { TxHistoryFilterType } from '../Table';
import { DashboardType } from '../DashboardContent';

type Transactions = {
  hash: string;
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
  kind: 'Repay' | 'Borrow';
  timestamp: string;
  type?: StrategyKey;
}[];

type PaginationDefaults = {
  totalPages: number;
  blockNumber: number;
};

type StrategyTxns = {
  name: StrategyKey;
  id: string;
  transactions: Transactions;
}[];

type Meta = {
  block: {
    number: number;
  };
};

type FetchTxnsResponse = SubGraphResponse<{ strategies: StrategyTxns; _meta: Meta }>;

type Props = {
  dashboardType: DashboardType;
  filter: TxHistoryFilterType;
  currentPage: number;
  rowsPerPage: number;
  blockNumber: number;
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

const useTxHistory = (props: Props) =>
  useApiQuery<Transactions>(
    getQueryKey.txHistory(),
    () => {
      return fetchTransactions(props);
    }
  );

const fetchTransactions = async (props: Props): Promise<Transactions> => {
  const { dashboardType, blockNumber, currentPage, rowsPerPage, filter } = props;
  const strategyKey = dashboardTypeToStrategyKey(dashboardType);
  const strategyQuery = strategyKey === StrategyKey.ALL ? `` : `where: { name: "${strategyKey}" }`;
  const blockNumberQueryParam = blockNumber > 0 ? `block: { number: ${blockNumber} }` : ``;
  let strategyAndBlockQuery = '';
  if (blockNumberQueryParam.length > 0 || strategyQuery.length > 0) {
    strategyAndBlockQuery = `(${blockNumberQueryParam} ${strategyQuery})`;
  }

  const paginationQuery = `skip: ${(currentPage - 1) * rowsPerPage} first: ${rowsPerPage}`;

  const dateNowSecs = Math.round(Date.now() / 1000);
  const filterQuery = `where: { timestamp_gt: ${dateNowSecs - txHistoryFilterTypeToSeconds(filter)} }`;

  const { data: res } = await fetchGenericSubgraph<FetchTxnsResponse>(
    env.subgraph.templeV2,
    `{
        strategies${strategyAndBlockQuery} {
        name
        id
        transactions(orderBy: timestamp, orderDirection: desc ${paginationQuery} ${filterQuery}) {
            hash
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
        }
    }`
  );
  if (!res) return [];
  const txns: Transactions = [];
  for (const strategy of res.strategies) {
    strategy.transactions.map((t) => txns.push({ type: strategy.name, ...t }));
  }
  return txns;
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
  const strategyQuery = strategyKey === StrategyKey.ALL ? `` : `( where: {name: "${strategyKey}"} )`;
  const dateNowSecs = Math.round(Date.now() / 1000);
  const filterQuery = `( where: { timestamp_gt: ${dateNowSecs - txHistoryFilterTypeToSeconds(filter)} } )`;

  const { data: res } = await fetchGenericSubgraph<FetchTxnsResponse>(
    env.subgraph.templeV2,
    `{
            strategies${strategyQuery} {
              transactions${filterQuery} {
                hash
              }
            }
            _meta {
              block {
                number
              }
            }
          }`
  );

  let pagDefaults: PaginationDefaults = {
    totalPages: 0,
    blockNumber: 0,
  };

  if (res) {
    let txCountTotal = 0;
    res.strategies.map((s) => (txCountTotal += s.transactions.length));
    pagDefaults = {
      totalPages: Math.ceil(txCountTotal / rowsPerPage),
      blockNumber: res._meta.block.number,
    };
  }
  return pagDefaults;
};

export { useTxHistory, useTxHistoryPaginationDefaults };
