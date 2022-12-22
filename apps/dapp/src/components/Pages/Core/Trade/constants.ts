import { TICKER_SYMBOL } from 'enums/ticker-symbol';

import { SwapMode, SwapReducerState } from './types';
import { buildSelectConfig, buildValueConfig } from './utils';
import { ZERO } from 'utils/bigNumber';

const { DAI, USDC, USDT, TEMPLE_TOKEN } = TICKER_SYMBOL;

const buyTokens = new Set([DAI, USDC, USDT]);
const sellTokens = new Set([DAI, USDC, USDT]);

export const TOKENS_BY_MODE = {
  BUY: [...buyTokens],
  SELL: [...sellTokens],
};

export const INITIAL_STATE: SwapReducerState = {
  mode: SwapMode.Buy,
  inputToken: DAI,
  outputToken: TEMPLE_TOKEN,
  inputValue: '',
  quote: null,
  inputTokenBalance: ZERO,
  outputTokenBalance: ZERO,
  slippageTolerance: 0.5,
  deadlineMinutes: 20,
  inputConfig: buildSelectConfig(DAI, SwapMode.Buy),
  outputConfig: buildValueConfig(TEMPLE_TOKEN),
  isTransactionPending: false,
  error: null,
};

export const FALLBACK_VAULT_APY = 9;
