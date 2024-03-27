import { useQuery } from '@tanstack/react-query';
import env from 'constants/env';
import { getQueryKey } from 'utils/react-query-helpers';
import { SubGraphResponse } from 'hooks/core/types';
import { fetchGenericSubgraph } from 'utils/subgraph';
import { StrategyKey } from '../DashboardConfig';

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

const QUERIED_FIELDS = `
  strategy{
    name
  }
  timeframe
  timestamp
  ${V2SnapshotMetrics.join('\n')}
  strategyTokens{
     ${STRATEGY_TOKEN_FIELDS.join('\n')}
  }
`;

export type V2StrategySnapshot = {
  timestamp: string;
  timeframe: string;
  strategy: { name: StrategyKey };
  strategyTokens: { [key in (typeof STRATEGY_TOKEN_FIELDS)[number]]: string }[];
} & { [key in V2SnapshotMetric]: string };

export function isV2SnapshotMetric(key?: string | null): key is V2SnapshotMetric {
  return V2SnapshotMetrics.some((m) => m === key);
}

type FetchV2StrategyDailySnapshotResponse = SubGraphResponse<{ strategyDailySnapshots: V2StrategySnapshot[] }>;
type FetchV2StrategyHourlySnapshotResponse = SubGraphResponse<{ strategyHourlySnapshots: V2StrategySnapshot[] }>;

const ONE_DAY_ONE_HOUR_MS = 25 * 60 * 60 * 1000;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

async function fetchStrategyHourlySnapshots() {
  const itemsPerPage = 1000;
  const now = new Date();
  const since = Math.floor((now.getTime() - ONE_DAY_ONE_HOUR_MS) / 1000).toString();
  // if # of strategies * 24 > 1000 we would be missing data
  // but we shouldnt be getting anywhere close to that
  const query = `
            query {
            strategyHourlySnapshots(first: ${itemsPerPage},
                                   orderBy: timestamp,
                                   orderDirection: asc,
                                   where: {timestamp_gt: ${since}}
                                   ) {
              ${QUERIED_FIELDS}
            }
            }`;
  const resp = await fetchGenericSubgraph<FetchV2StrategyHourlySnapshotResponse>(env.subgraph.templeV2, query);
  return resp?.data?.strategyHourlySnapshots ?? [];
}

async function fetchStrategyDailySnapshots() {
  const now = new Date();
  // the largest value from the chart time range selector 1W | 1M | 1Y
  let since = Math.floor((now.getTime() - ONE_YEAR_MS) / 1000).toString();
  const result: V2StrategySnapshot[] = [];
  const itemsPerPage = 1000; // current max page size
  while (true) {
    //  we could be missing data with this pagination strategy if
    //  the dataset contain snapshots for different strats
    //  created at the exact same timestamp
    //  and all such snapshots do not fit in the same page
    //  imho very unlikely, but possible?
    //  solution would be to use timestamp_GTE: ${since}
    //  and deduplicate two consecutive pages
    const query = `
            query {
            strategyDailySnapshots(first: ${itemsPerPage},
                                   orderBy: timestamp,
                                   orderDirection: asc,
                                   where: {timestamp_gt: ${since}}) {
              ${QUERIED_FIELDS}
            }
            }`;
    const page = await fetchGenericSubgraph<FetchV2StrategyDailySnapshotResponse>(env.subgraph.templeV2, query);
    const itemsOnPage = page.data?.strategyDailySnapshots.length ?? 0;
    if (page.data) {
      result.push(...page.data.strategyDailySnapshots);
      const latestSnapshot = page.data.strategyDailySnapshots.at(-1);
      if (!latestSnapshot) break;
      since = latestSnapshot.timestamp;
    }
    if (itemsOnPage < itemsPerPage) {
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
