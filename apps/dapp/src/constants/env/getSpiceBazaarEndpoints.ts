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

  // return only unique endpoints
  return [...new Set(allEndpoints)];
};
