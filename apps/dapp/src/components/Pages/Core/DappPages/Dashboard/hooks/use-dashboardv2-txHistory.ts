import { fetchGenericSubgraph } from 'utils/subgraph';
import env from 'constants/env';
import { SubGraphResponse } from 'hooks/core/types';
import { useApiQuery, ROOT_QUERY_KEY } from 'hooks/api/use-react-query';
import { TxHistoryFilterType } from '../Table';
import { DashboardType } from '../DashboardContent';

export type StrategyType = 'TlcStrategy' | 'DsrBaseStrategy' | 'RamosStrategy' | 'TempleBaseStrategy' | 'All';

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
  type?: StrategyType;
}[];

type PaginationDefaults = {
  totalPages: number;
  blockNumber: number;
};

type StrategyTxns = {
  name: StrategyType;
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

const useTxHistory = (props: Props) =>
  useApiQuery<Transactions, DashboardType>(
    ROOT_QUERY_KEY.GET_TX_HISTORY,
    () => {
      return fetchTransactions(props);
    },
    props.dashboardType
  );

const fetchTransactions = async (props: Props): Promise<Transactions> => {
  const { dashboardType, blockNumber, currentPage, rowsPerPage, filter } = props;
  const strategyType = dashboardTypeToStrategyType(dashboardType);
  const strategyQuery = strategyType === 'All' ? `` : `where: { name: "${strategyType}" }`;
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
  useApiQuery<PaginationDefaults>(ROOT_QUERY_KEY.GET_TX_PAG_DEFAULT, async () => {
    return fetchPaginationDefaults(dashboardType, rowsPerPage, filter);
  });
const fetchPaginationDefaults = async (
  dashboardType: DashboardType,
  rowsPerPage: number,
  filter: TxHistoryFilterType
) => {
  const strategyType = dashboardTypeToStrategyType(dashboardType);
  const strategyQuery = strategyType === 'All' ? `` : `( where: {name: "${strategyType}"} )`;
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
