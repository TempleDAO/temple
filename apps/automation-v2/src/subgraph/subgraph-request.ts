import axios, { AxiosError } from 'axios';

import { SubGraphQuery, SubGraphResponse, SubgraphError } from './types';
import { Logger } from '@mountainpath9/overlord';

export const subgraphRequest = <R extends SubGraphResponse<object>>(
  subgraphUrl: string,
  query: SubGraphQuery,
  logger?: Logger
) => {
  const subgraphRequest = async () => {
    logger?.info(
      `try axios post to: \n{ "subgraphUrl": "${subgraphUrl}", "subgraphQuery": ${JSON.stringify(
        query.query
      ) }}`
    );
    try {
      const res = await axios.post<R>(subgraphUrl, query);
      logger?.info(`res status code ${res.status} ${res.statusText}`);
      if ((res.data?.errors || []).length > 0) {
        const firstErrorMessage = res.data.errors![0].message;
        throw new AxiosError(
          firstErrorMessage,
          res.statusText,
          res.config,
          res.request,
          res
        );
      }
      return res;
    } catch (err) {
      throw new SubgraphError('Error calling subgraph', err as AxiosError);
    }
  };

  return subgraphRequest;
};
