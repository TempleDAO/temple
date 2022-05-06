export class SubgraphQueryError extends Error {
  constructor(graphqlErrors: any[]) {
    super(graphqlErrors.map((errorPath) => errorPath.message).join(';'));
    this.name = 'SubgraphQueryError';
  }
}

export const fetchSubgraph = async (query: string) => {
  const result = await fetch(
    'https://api.thegraph.com/subgraphs/name/templedao/templedao-metrics',
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
      }),
    }
  );
  const response = await result.json();

  if (response.errors) {
    throw new SubgraphQueryError(response.errors);
  }
  return response;
};
