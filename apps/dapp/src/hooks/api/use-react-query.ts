import { UseQueryResult, useQuery } from '@tanstack/react-query';

// Centralize all the dApp react query keys in case we need to cancel or invalidate them
// through the app, this makes it easier to track them, please add new ones as required
export const getQueryKey = {
  txPagDefault: () => ['getTxPaginationDefaultValues'],
  txHistory: () => ['getTxHistory'],
  metrics: (s?: StrategyKey) => {return s ? ['getMetrics', s] : ['getMetrics']},
  trvMetrics: () => ['getTreasureReserveMetrics'],
}

export enum StrategyKey {
  RAMOS = 'RamosStrategy',
  TLC = 'TlcStrategy',
  TEMPLEBASE = 'TempleBaseStrategy',
  DSRBASE = 'DsrBaseStrategy',
  ALL = 'All'
}

const CACHE_TTL = 1000 * 60;

/** useApiQuery: wrapper of useQuery for general dApp configs
 * 
 * @param key select ROOT_QUERY_KEY, add new one when required
 * @param fn callback function to be executed
 * @returns UseQueryResult\<Response>
 */
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
