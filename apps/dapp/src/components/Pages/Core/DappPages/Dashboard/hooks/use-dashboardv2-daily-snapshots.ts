import env from 'constants/env';
import { getQueryKey, useApiQuery } from 'hooks/api/use-react-query';
import { SubGraphResponse } from 'hooks/core/types';
import { fetchGenericSubgraph } from 'utils/subgraph';

const V2DailySnapshotMetrics = [
  'totalMarketValueUSD',
  'debtUSD',
  'netDebtUSD',
  'creditUSD',
  'principalUSD',
  'accruedInterestUSD',
  'nominalEquityUSD',
  'nominalPerformance',
  'benchmarkedEquityUSD',
  'benchmarkPerformance',
] as const;

export type V2DailySnapshotMetric = (typeof V2DailySnapshotMetrics)[number];

export type V2StrategyDailySnapshot = {
  timestamp: string;
  timeframe: string;
  strategy: { name: string };
} & { [key in V2DailySnapshotMetric]: string };

export function isV2DailySnapshotMetric(key?: string | null): key is V2DailySnapshotMetric {
  return V2DailySnapshotMetrics.some((m) => m === key);
}

type FetchV2StrategyDailySnapshotResponse = SubGraphResponse<{ strategyDailySnapshots: V2StrategyDailySnapshot[] }>;

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

async function fetchStrategyDailySnapshots() {
  const now = new Date();
  // the largest value from the chart time range selector 1W | 1M | 1Y
  let since = Math.floor((now.getTime() - ONE_YEAR_MS) / 1000).toString();
  const result: V2StrategyDailySnapshot[] = [];
  const itemsPerPage = 1000; // current max page size
  const metrics = V2DailySnapshotMetrics.join('\n');
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
                strategy{
                    name
                }
                timeframe
                timestamp
                ${metrics}
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

export default function useV2StrategyDailySnapshotData() {
  return useApiQuery<V2StrategyDailySnapshot[]>(getQueryKey.allStrategiesDailySnapshots(), fetchStrategyDailySnapshots);
}
