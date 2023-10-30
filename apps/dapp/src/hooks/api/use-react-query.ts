import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { StrategyKey } from 'components/Pages/Core/DappPages/Dashboard/hooks/use-dashboardv2-metrics';

// Centralize all the dApp react query keys in case we need to cancel or invalidate them
// through the app, this makes it easier to track them, please add new ones as required
export const getQueryKey = {
  txPagDefault: () => ['getTxPaginationDefaultValues'],
  txHistory: () => ['getTxHistory'],
  metrics: (s?: StrategyKey) => (s ? ['getMetrics', s] : ['getMetrics']),
  trvMetrics: () => ['getTreasureReserveMetrics'],
  allStrategiesDailySnapshots: () => ['strategyDailySnapshots'],
  allStrategiesHourlySnapshots: () => ['strategyHourlySnapshots'],
};

const CACHE_TTL = 1000 * 60;

/** useApiQuery: wrapper of useQuery for general dApp configs
 *
 * @param key use getQueryKey fn, add new one when required
 * @param fn callback query function
 * @returns UseQueryResult\<Response>
 */
// prettier-ignore
function useApiQuery <Response>(
  key: string[],
  fn: () => Promise<Response>
): UseQueryResult<Response> {
  return useQuery({
    queryKey: key,
    queryFn: fn,
    refetchInterval: CACHE_TTL,
    staleTime: CACHE_TTL,
  });
}

export { useApiQuery };
