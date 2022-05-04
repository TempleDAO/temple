import axios from 'axios';

import { SubGraphQuery, SubGraphResponse } from './core/types';
import useRequestState from './use-request-state';

export const useSubgraphRequest = <R extends SubGraphResponse<object>>(subgraphUrl: string, query: SubGraphQuery) => {
  const subgraphRequest = async () => {
    try {
      const { data } = await axios.post(subgraphUrl, query);
      
      if (!data.errors) {
        const firstErrorMessage = data.errors[0].message;
        throw new Error(firstErrorMessage);
      }

      return data;
    } catch (err) {
      throw err;
    }
  };

  return useRequestState<R>(subgraphRequest)
};
