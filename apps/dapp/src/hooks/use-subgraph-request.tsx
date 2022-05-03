import axios from 'axios';

import { SubGraphQuery, SubGraphResponse } from './core/types';
import useRequestState from './use-request-state';

export const useSubgraphRequest = <R extends SubGraphResponse<object>>(subgraphUrl: string, query: SubGraphQuery) => {
  const subgraphRequest = async () => {
    const { data } = await axios.post(subgraphUrl, query);
    return data;
  };

  return useRequestState<R>(subgraphRequest)
};
