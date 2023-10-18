import environmentConfig from 'constants/env';
import { useState } from 'react';
import useInterval from 'use-interval';
import { fetchGenericSubgraph } from 'utils/subgraph';

export interface V2StrategyDailySnapshot {
    timestamp: string;
    timeframe: string;
    strategy: { name: string };
    totalMarketValueUSD: string;
    debtUSD: string;
    creditUSD: string;
    principalUSD: string;
    accruedInterestUSD: string;
    nominalEquityUSD: string;
    nominalPerformance: string;
    benchmarkedEquityUSD: string;
    benchmarkPerformance: string;
}

export type V2StrategyMetric = keyof Omit<V2StrategyDailySnapshot, 'timeframe' | 'timestamp' | 'strategy'>;


async function fetchCoreV2<RawResponse extends Record<string, unknown>>(query: string) {
    const resp: RawResponse = (await fetchGenericSubgraph(environmentConfig.subgraph.v2, query)).data
    return resp
}


async function fetchStrategyDailySnapshots(now: Date) {
    // TODO: filter strategies here?
    let since = Math.floor((now.getTime() - 365 * 24 * 60 * 60 * 1000) / 1000).toString()
    const result: V2StrategyDailySnapshot[] = []
    const itemsPerPage = 1000 // current max page size
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
                debtUSD
                nominalEquityUSD
                nominalPerformance
                principalUSD
                totalMarketValueUSD
            }
            }`
        const page = await fetchCoreV2<{ strategyDailySnapshots: V2StrategyDailySnapshot[] }>(query)
        result.push(...page.strategyDailySnapshots)
        since = page.strategyDailySnapshots[0].timestamp
        if (page.strategyDailySnapshots.length < itemsPerPage) {
            break
        }
    }
    return result
}

export default function useCoreV2StrategyData(intervalMinutes = 20) {
    const [dailyMetrics, setDailyMetrics] = useState<V2StrategyDailySnapshot[]>([])

    async function refreshMetrics() {
        console.debug(`Refetching v2 strategy metrics`)
        const data = await fetchStrategyDailySnapshots(new Date())
        setDailyMetrics(data ?? [])
    }

    useInterval(refreshMetrics, intervalMinutes * 60 * 1000, true);
    return { dailyMetrics }

}
