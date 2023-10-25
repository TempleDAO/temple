import { UseQueryResult, useQuery } from '@tanstack/react-query';

// Centralize all the dApp react query keys in case we need to cancel or invalidate them
// through the app, this makes it easier to track them
export enum ROOT_QUERY_KEY {
  GET_TX_PAG_DEFAULT = 'getTxPaginationDefaultValues',
  GET_TX_HISTORY = 'getTxHistory',
}

const CACHE_TTL = 1000 * 60;


/** useApiQuery: has two signatures to overload it
 * 
 * 1. Generic \<Response> only requires a ROOT_QUERY_KEY and callback fn
 * 2. Generics <Response, AdditionalKeyType> same as above but it also concatenate the additionalKey to the ROOT_QUERY_KEY
 * 
 * @param key select ROOT_QUERY_KEY, add new one when required
 * @param fn callback function to be executed
 * @param additionalKey callback function to be executed
 * @returns UseQueryResult\<Response>
 */
function useApiQuery <Response>(
  key: ROOT_QUERY_KEY,
  fn: () => Promise<Response>
): UseQueryResult<Response>;
function useApiQuery <Response, AdditionalKeyType>(
  key: ROOT_QUERY_KEY,
  fn: () => Promise<Response>,
  additionalKey: AdditionalKeyType
): UseQueryResult<Response>;
function useApiQuery <Response, AdditionalKeyType>(
  key: ROOT_QUERY_KEY,
  fn: () => Promise<Response>,
  additionalKey?: AdditionalKeyType
) {
  return useQuery({
    queryKey: [key, additionalKey as AdditionalKeyType],
    queryFn: fn,
    refetchInterval: CACHE_TTL,
    staleTime: CACHE_TTL,
  });
}

export { useApiQuery };
