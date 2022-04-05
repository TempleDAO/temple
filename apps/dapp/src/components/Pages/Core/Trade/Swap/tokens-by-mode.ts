import { TICKER_SYMBOL } from 'enums/ticker-symbol';

const { FRAX, FEI, ETH, USDC } = TICKER_SYMBOL;

const TOKENS_BY_MODE = {
  BUY: [FRAX, FEI, ETH, USDC],
  SELL: [FRAX, FEI],
};

export default TOKENS_BY_MODE;
