export const fetchSubgraph = async (query: string) => {
  const result = await fetch(
    'https://api.thegraph.com/subgraphs/name/templedao/templedao-balances',
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
  return response;
};
