import { useQuery } from '@tanstack/react-query';
import env from 'constants/env';
import { getQueryKey } from 'utils/react-query-helpers';
import {
  queryStrategyDailySnapshots,
  queryStrategyHourlySnapshots,
  subgraphQuery,
  V2StrategySnapshot,
} from 'utils/subgraph';

const V2SnapshotMetrics = [
  'totalMarketValueUSD',
  'debtUSD',
  'netDebtUSD',
  'creditUSD',
  'principalUSD',
  'accruedInterestUSD',
  'benchmarkedEquityUSD',
] as const;

export type V2SnapshotMetric = (typeof V2SnapshotMetrics)[number];

// these tokens add up to the corresponding metric
const STRATEGY_TOKEN_FIELDS = [
  'symbol',
  'debtUSD',
  'creditUSD',
  'assetBalance',
  'marketValueUSD',
  'principalUSD',
  'accruedInterestUSD',
] as const;

export type StrategyTokenField = (typeof STRATEGY_TOKEN_FIELDS)[number];

export function isV2SnapshotMetric(
  key?: string | null
): key is V2SnapshotMetric {
  return V2SnapshotMetrics.some((m) => m === key);
}

const ONE_DAY_ONE_HOUR_MS = 25 * 60 * 60 * 1000;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

async function fetchStrategyHourlySnapshots() {
  const itemsPerPage = 1000;
  const now = new Date();
  const since = Math.floor(
    (now.getTime() - ONE_DAY_ONE_HOUR_MS) / 1000
  ).toString();
  // if # of strategies * 24 > 1000 we would be missing data
  // but we shouldnt be getting anywhere close to that
  const resp = await subgraphQuery(
    env.subgraph.templeV2Balances,
    queryStrategyHourlySnapshots(
      V2SnapshotMetrics,
      STRATEGY_TOKEN_FIELDS,
      itemsPerPage,
      since
    )
  );

  return resp.strategyHourlySnapshots;
}

// Fetch the last 10 years of data, by default
// This will be filtered by the chart time range selector later
// No strategy has been running for 10 years, so we won't technically have that much data
// But for shutdown strategies, we need all available data
// This is a bit of a hack, but a reasonable compromise for now.
// Potentially we could configure a "start date" for the strategy to limit the data we're fetching
// But that's overkill for now, considering the amount of data we're fetching
const TEN_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000;

async function fetchStrategyDailySnapshots() {
  const now = new Date();
  // the largest value from the chart time range selector 1W | 1M | 1Y
  const since = Math.floor((now.getTime() - TEN_YEARS_MS) / 1000).toString();
  const result: V2StrategySnapshot[] = [];
  const MAX_PAGE_SIZE = 1000; // current max page size
  let skip = 0;
  while (true) {
    const page = await subgraphQuery(
      env.subgraph.templeV2Balances,
      queryStrategyDailySnapshots(
        V2SnapshotMetrics,
        STRATEGY_TOKEN_FIELDS,
        MAX_PAGE_SIZE,
        since,
        skip
      )
    );
    const itemsOnPage = page.strategyDailySnapshots.length ?? 0;
    result.push(...page.strategyDailySnapshots);
    skip += itemsOnPage;
    if (itemsOnPage < MAX_PAGE_SIZE) {
      break;
    }
  }
  return result;
}

const CACHE_TTL = 1000 * 60;

export default function useV2StrategySnapshotData() {
  const {
    data: dailyMetrics,
    isLoading: dL,
    isError: dE,
  } = useQuery({
    queryKey: getQueryKey.allStrategiesDailySnapshots(),
    queryFn: fetchStrategyDailySnapshots,
    refetchInterval: CACHE_TTL,
    staleTime: CACHE_TTL,
  });
  const {
    data: hourlyMetrics,
    isLoading: hL,
    isError: hE,
  } = useQuery({
    queryKey: getQueryKey.allStrategiesHourlySnapshots(),
    queryFn: fetchStrategyHourlySnapshots,
    refetchInterval: CACHE_TTL,
    staleTime: CACHE_TTL,
  });

  return {
    dailyMetrics,
    hourlyMetrics,
    isLoadingOrError: dL || dE || hL || hE,
  };
}
