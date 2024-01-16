import axios from 'axios';

import { SubGraphQuery, SubGraphResponse, SubgraphError } from './core/types';
import useRequestState from './use-request-state';

export const useSubgraphRequest = <R extends SubGraphResponse<object>>(
  subgraphUrl: string,
  query: SubGraphQuery
) => {
  const subgraphRequest = async () => {
    try {
      const { data } = await axios.post<R>(subgraphUrl, query);

      if ((data?.errors || []).length > 0) {
        const firstErrorMessage = data.errors![0].message;
        throw new Error(firstErrorMessage);
      }

      return data;
    } catch (err) {
      throw new SubgraphError('Error calling subgraph', err as Error);
    }
  };

  return useRequestState(subgraphRequest);
};
