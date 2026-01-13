import { getAppConfig } from 'constants/newenv';

export type SpiceBazaarEndpoint = {
  url: string;
  label: string;
};

export const getAllSpiceBazaarSubgraphEndpoints = (): SpiceBazaarEndpoint[] => {
  const spiceAuctions = getAppConfig().spiceBazaar.spiceAuctions;

  // get each endpoint configured for each spice auction (regardless if active or not)
  const allEndpoints = spiceAuctions.map((auction) => ({
    url: auction.subgraphUrl,
    label: auction.chainId.toString(),
  }));

  const uniqueEndpointsMap = new Map<string, SpiceBazaarEndpoint>();
  allEndpoints.forEach((endpoint) => {
    if (!uniqueEndpointsMap.has(endpoint.url)) {
      uniqueEndpointsMap.set(endpoint.url, endpoint);
    }
  });
  return Array.from(uniqueEndpointsMap.values());
};
