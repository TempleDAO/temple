const ENV_VARS = import.meta.env;

export const create0xQuoteUrl = (sellToken: string, sellAmount: string) => {
  return `https://api.0x.org/swap/v1/quote?sellToken=${sellToken}&sellAmount=${sellAmount}&buyToken=${ENV_VARS.VITE_PUBLIC_STABLE_COIN_ADDRESS}`;
};

export const createZapperTokenBalanceUrl = (walletAddress: string) => {
  return `https://api.zapper.fi/v1/protocols/tokens/balances?addresses[]=${walletAddress}&api_key=${ENV_VARS.VITE_PUBLIC_ZAPPER_API_KEY}`;
};
