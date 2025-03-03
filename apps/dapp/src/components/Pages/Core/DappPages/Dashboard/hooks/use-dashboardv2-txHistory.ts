import env from 'constants/env';
import { TxHistoryFilterType } from '../Table';
import { TableHeaders, TxHistoryTableHeader } from '../Table/TxnHistoryTable';
import { getQueryKey } from 'utils/react-query-helpers';
import { useQuery } from '@tanstack/react-query';
import { DashboardData, isTRVDashboard } from '../DashboardConfig';
import {
  subgraphQuery,
  queryStrategyTransactions,
  StrategyTransactions,
  queryStrategyTransactionsMeta,
} from 'utils/subgraph';

type AvailableRows = {
  totalTransactionCount: number;
  totalRowCount: number;
  blockNumber: number;
};

export type RowFilter = {
  type?: string;
  strategy?: string;
  token?: string;
};

export type TxHistoryProps = {
  dashboardData: DashboardData;
  txFilter: TxHistoryFilterType;
  rowFilter: RowFilter;
  offset: number;
  limit: number;
  blockNumber: number;
  tableHeaders: TxHistoryTableHeader[];
};

export type TxHistoryAvailableRowsProps = {
  dashboardData: DashboardData;
  txFilter: TxHistoryFilterType;
  rowFilter: RowFilter;
};

const txHistoryFilterTypeToSeconds = (filter: TxHistoryFilterType) => {
  const dateNowSecs = Math.round(Date.now() / 1000);
  const oneDaySecs = 86400;
  switch (filter) {
    case TxHistoryFilterType.all:
      return dateNowSecs;
    case TxHistoryFilterType.last30days:
      return oneDaySecs * 30;
    case TxHistoryFilterType.lastweek:
      return oneDaySecs * 7;
  }
};

const getTableHeaderOrderByType = (tableHeader?: TxHistoryTableHeader) => {
  if (!tableHeader) return 'timestamp';
  switch (tableHeader.name) {
    case TableHeaders.Date:
      return 'timestamp';
    case TableHeaders.Strategy:
      return 'strategy__name';
    case TableHeaders.Type:
      return 'name';
    case TableHeaders.Token:
      return 'token__name';
    case TableHeaders.Amount:
      return 'amount';
    case TableHeaders.TxHash:
      return 'hash';
  }
};

const useTxHistory = (props: TxHistoryProps) =>
  useQuery({
    queryKey: getQueryKey.txHistory(props),
    queryFn: () => fetchTransactions(props),
  });

const fetchTransactions = async (
  props: TxHistoryProps
): Promise<StrategyTransactions> => {
  const {
    dashboardData,
    blockNumber,
    offset,
    limit,
    txFilter,
    rowFilter,
    tableHeaders,
  } = props;

  const strategyKey = dashboardData.key;
  const strategyQuery = isTRVDashboard(strategyKey)
    ? ``
    : `strategy_: {name: "${strategyKey}"}`;
  const blockNumberQueryParam =
    blockNumber > 0 ? `block: { number: ${blockNumber} }` : ``;

  const dateNowSecs = Math.round(Date.now() / 1000);
  const typeRowFilterQuery = `${
    rowFilter.type ? 'name_contains_nocase: "' + rowFilter.type + '"' : ''
  }`;
  const strategyRowFilterQuery = `${
    rowFilter.strategy
      ? 'strategy_: {name_contains_nocase: "' + rowFilter.strategy + '"}'
      : ''
  }`;
  const tokenRowFilterQuery = `${
    rowFilter.token
      ? 'token_: {symbol_contains_nocase: "' + rowFilter.token + '"}'
      : ''
  }`;
  const whereQuery = `
    ${blockNumberQueryParam} 
    where: { 
      ${strategyQuery} 
      timestamp_gt: ${dateNowSecs - txHistoryFilterTypeToSeconds(txFilter)} 
      ${typeRowFilterQuery} 
      ${strategyRowFilterQuery} 
      ${tokenRowFilterQuery}
    }`;
  const orderHeader = tableHeaders.find((h) => h.orderDesc !== undefined);

  // set default ordering
  const orderBy = getTableHeaderOrderByType(
    tableHeaders.find((h) => h.orderDesc !== undefined)
  );
  const orderType = orderHeader
    ? orderHeader.orderDesc
      ? 'desc'
      : 'asc'
    : 'desc';

  const res = await subgraphQuery(
    env.subgraph.templeV2,
    queryStrategyTransactions(orderBy, orderType, offset, limit, whereQuery)
  );
  return res.strategyTransactions;
};

const useTxHistoryAvailableRows = (props: TxHistoryAvailableRowsProps) =>
  useQuery({
    queryKey: getQueryKey.txHistoryAvailableRows(props),
    queryFn: () => fetchTxHistoryAvailableRows(props),
  });

const fetchTxHistoryAvailableRows = async (
  props: TxHistoryAvailableRowsProps
): Promise<AvailableRows> => {
  const { dashboardData, rowFilter, txFilter } = props;
  const strategyKey = dashboardData.key;
  const strategyQuery = isTRVDashboard(strategyKey)
    ? ``
    : `strategy_: {name: "${strategyKey}"}`;
  const dateNowSecs = Math.round(Date.now() / 1000);
  const typeRowFilterQuery = `${
    rowFilter.type ? 'name_contains_nocase: "' + rowFilter.type + '"' : ''
  }`;
  const strategyRowFilterQuery = `${
    rowFilter.strategy
      ? 'strategy_: {name_contains_nocase: "' + rowFilter.strategy + '"}'
      : ''
  }`;
  const tokenRowFilterQuery = `${
    rowFilter.token
      ? 'token_: {symbol_contains_nocase: "' + rowFilter.token + '"}'
      : ''
  }`;
  // get the max allowed 1000 records for a more accurate totalPages calculation
  const whereQuery = `first: 1000 
    where: { 
      ${strategyQuery} 
      timestamp_gt: ${dateNowSecs - txHistoryFilterTypeToSeconds(txFilter)} 
      ${typeRowFilterQuery} 
      ${strategyRowFilterQuery} 
      ${tokenRowFilterQuery}
    }`;

  const res = await subgraphQuery(
    env.subgraph.templeV2,
    queryStrategyTransactionsMeta(whereQuery)
  );

  let result: AvailableRows = {
    totalRowCount: 0,
    blockNumber: 0,
    totalTransactionCount: 0,
  };
  // const rowFilters = rowFilter.strategy || rowFilter.token || rowFilter.type;
  let hasRowFilters = false;
  if (rowFilter.strategy) hasRowFilters = rowFilter.strategy.length > 0;
  if (rowFilter.token) hasRowFilters = rowFilter.token.length > 0;
  if (rowFilter.type) hasRowFilters = rowFilter.type.length > 0;

  let totalRowCount = 0;
  if (
    props.txFilter === TxHistoryFilterType.all &&
    isTRVDashboard(strategyKey) &&
    !hasRowFilters
  ) {
    // if user chooses all transactions, sum the txCountTotal of every strategy, we don't use this
    // calc for the last30days or lastweek filters because it could show an incorrect number of totalPages
    totalRowCount = res.metrics[0].strategyTransactionCount;
  } else {
    // if user chooses last30days or lastweek filters, count the length of txs of each strategy
    // in this case there maybe a chance of incorrect calc if there are more than 1000 records,
    // which is unlikely in foreseeable future. This due to the max 1000 records subgraph limitation
    totalRowCount = res.strategyTransactions.length;
  }

  result = {
    totalRowCount,
    blockNumber: res._meta.block.number,
    totalTransactionCount: totalRowCount,
  };

  return result;
};

export { useTxHistory, useTxHistoryAvailableRows };
