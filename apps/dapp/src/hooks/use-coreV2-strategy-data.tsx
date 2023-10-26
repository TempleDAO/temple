import { useQuery } from '@tanstack/react-query';
import environmentConfig from 'constants/env';
import { fetchGenericSubgraph } from 'utils/subgraph';

export interface V2StrategyDailySnapshot {
  timestamp: string;
  timeframe: string;
  strategy: { name: string };
  totalMarketValueUSD: string;
  debtUSD: string;
  netDebtUSD: string;
  creditUSD: string;
  principalUSD: string;
  accruedInterestUSD: string;
  nominalEquityUSD: string;
  nominalPerformance: string;
  benchmarkedEquityUSD: string;
  benchmarkPerformance: string;
}

export type V2StrategyMetric = keyof Omit<V2StrategyDailySnapshot, 'timeframe' | 'timestamp' | 'strategy'>;

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

async function fetchCoreV2<RawResponse extends Record<string, unknown>>(query: string) {
  const resp: RawResponse = (await fetchGenericSubgraph(environmentConfig.subgraph.templeV2, query)).data;
  return resp;
}

async function fetchStrategyDailySnapshots() {
  const now = new Date();
  let since = Math.floor((now.getTime() - ONE_YEAR_MS) / 1000).toString();
  const result: V2StrategyDailySnapshot[] = [];
  const itemsPerPage = 1000; // current max page size
  while (true) {
    const query = `
            query {
            strategyDailySnapshots(first: ${itemsPerPage},
                                   orderBy: timestamp,
                                   orderDirection: desc,
                                   where: {timestamp_gt: ${since}}) {
                strategy{
                    name
                }
                timeframe
                timestamp
                accruedInterestUSD
                benchmarkPerformance
                benchmarkedEquityUSD
                creditUSD
                netDebtUSD
                debtUSD
                nominalEquityUSD
                nominalPerformance
                principalUSD
                totalMarketValueUSD
            }
            }`;
    const page = await fetchCoreV2<{ strategyDailySnapshots: V2StrategyDailySnapshot[] }>(query);
    result.push(...page.strategyDailySnapshots);
    since = page.strategyDailySnapshots[0].timestamp;
    if (page.strategyDailySnapshots.length < itemsPerPage) {
      break;
    }
  }
  return result;
}

export default function useCoreV2StrategyData() {
  const TWENTY_MINUTES_MS = 1000 * 60 * 20;
  const { data: dailyMetrics } = useQuery({
    queryKey: ['strategiesDailySnapshots'],
    queryFn: fetchStrategyDailySnapshots,
    refetchInterval: TWENTY_MINUTES_MS,
    staleTime: TWENTY_MINUTES_MS,
  });

  return { dailyMetrics };
}
