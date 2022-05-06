import { TICKER_SYMBOL } from 'enums/ticker-symbol';

const { FRAX, FEI, ETH, USDC } = TICKER_SYMBOL;

const buyTokens = new Set([FRAX, FEI, ETH, USDC]);
const sellTokens = new Set([FRAX, FEI]);

export const TOKENS_BY_MODE = {
  BUY: [...buyTokens],
  SELL: [...sellTokens],
};
