import { fetchGenericSubgraph } from 'utils/subgraph';
import env from 'constants/env';
import { SubGraphResponse } from 'hooks/core/types';
import { CACHE_TTL, useApiQuery } from 'hooks/api/use-react-query';
import { TxHistoryFilterType } from '../Table';
import { DashboardType } from '../DashboardContent';
import { StrategyKey } from './use-dashboardv2-metrics';
import { useQuery } from '@tanstack/react-query';

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

type AvailableRows = {
  totalRowCount: number;
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
  offset: number;
  limit: number;
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
  useQuery({
    queryKey: ['TxHistory', props.dashboardType, props.filter, props.offset, props.limit, props.blockNumber],
    queryFn: () => fetchTransactions(props),
    refetchInterval: CACHE_TTL,
    staleTime: CACHE_TTL,
  });

const fetchTransactions = async (props: Props): Promise<Transactions> => {
  const { dashboardType, blockNumber, offset, limit, filter } = props;
  const strategyKey = dashboardTypeToStrategyKey(dashboardType);
  const strategyQuery = strategyKey === StrategyKey.ALL ? `` : `where: { name: "${strategyKey}" }`;
  const blockNumberQueryParam = blockNumber > 0 ? `block: { number: ${blockNumber} }` : ``;
  let strategyAndBlockQuery = '';
  if (blockNumberQueryParam.length > 0 || strategyQuery.length > 0) {
    strategyAndBlockQuery = `(${blockNumberQueryParam} ${strategyQuery})`;
  }

  const paginationQuery = `skip: ${offset} first: ${limit}`;

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


const useTxHistoryAvailableRows = (
  dashboardType: DashboardType,
  filter: TxHistoryFilterType
) => useQuery({
    queryKey: ['TxHistoryAvailableRows', dashboardType, filter],
    queryFn: () => fetchTxHistoryAvailableRows(dashboardType, filter),
    refetchInterval: CACHE_TTL,
    staleTime: CACHE_TTL,
  });

const fetchTxHistoryAvailableRows = async (
  dashboardType: DashboardType,
  filter: TxHistoryFilterType
): Promise<AvailableRows> => {
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

  let result: AvailableRows = {
    totalRowCount: 0,
    blockNumber: 0,
  };

  if (res) {
    let totalRowCount = 0;
    res.strategies.map((s) => (totalRowCount += s.transactions.length));
    result = {
      totalRowCount,
      blockNumber: res._meta.block.number,
    };
  }
  return result;
};

export { useTxHistory, useTxHistoryAvailableRows };
