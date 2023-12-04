import axios, { AxiosError } from 'axios';

import { SubGraphQuery, SubGraphResponse, SubgraphError } from './types';
import { Logger } from '@mountainpath9/overlord';

export const subgraphRequest = <R extends SubGraphResponse<object>>(
  subgraphUrl: string,
  query: SubGraphQuery,
  logger: Logger
) => {
  const subgraphRequest = async () => {
    logger.info(
      `try axios post to: \n{ "subgraphUrl": "${subgraphUrl}", "subgraphQuery": ${JSON.stringify(
        query.query
      )}}`
    );
    const res = await axios.post<R>(subgraphUrl, query);
    logger.info(`res status code ${res.status} ${res.statusText}`);
    if ((res.data?.errors || []).length > 0) {
      const dataErrors = JSON.stringify(res.data.errors?.map(e => e.message));
      throw new AxiosError(
        dataErrors,
        res.statusText,
        res.config,
        res.request,
        res
      );
    }
    return res;
  };

  return subgraphRequest;
};
