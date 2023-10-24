import { useQuery } from '@tanstack/react-query';

export enum QUERY_KEY {
  GET_METRICS = 'getMetrics',
  GET_TX_HISTORY = 'getTxHistory',
}

const CACHE_TTL = 1000 * 60;

export const CreateApiQuery = <KeyType, Response>(
  key: QUERY_KEY,
  keyType: KeyType,
  fn: () => Promise<Response>
) => {
  return useQuery({
    queryKey: [key, keyType as KeyType],
    queryFn: fn,
    refetchInterval: CACHE_TTL,
    staleTime: CACHE_TTL,
  });
};
