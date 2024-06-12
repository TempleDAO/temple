import { SubGraphResponse } from 'hooks/core/types';

export class SubgraphQueryError extends Error {
  constructor(graphqlErrors: any[]) {
    super(graphqlErrors.map((errorPath) => errorPath.message).join(';'));
    this.name = 'SubgraphQueryError';
  }
}

// Preserved to avoid a larger refactor across the code base for now
export const fetchSubgraph = async <R extends SubGraphResponse<object>>(
  query: string
) => {
  return fetchGenericSubgraph<R>(
    'https://subgraph.satsuma-prod.com/a912521dd162/templedao/temple-metrics/api',
    query
  );
};

export const fetchGenericSubgraph = async <R extends SubGraphResponse<object>>(
  url: string,
  query: string
) => {
  const result = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
    }),
  });
  const response: R = await result.json();

  if (response.errors) {
    throw new SubgraphQueryError(response.errors);
  }
  return response;
};
