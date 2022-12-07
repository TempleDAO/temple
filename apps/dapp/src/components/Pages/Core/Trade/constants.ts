import { TICKER_SYMBOL } from 'enums/ticker-symbol';

import { SwapMode, SwapReducerState } from './types';
import { buildSelectConfig, buildValueConfig, createButtonLabel } from './utils';
import { ZERO } from 'utils/bigNumber';

const { FRAX, DAI, USDC, USDT } = TICKER_SYMBOL;

const buyTokens = new Set([FRAX, DAI, USDC, USDT]);
const sellTokens = new Set([FRAX, DAI, USDC, USDT]);

export const TOKENS_BY_MODE = {
  BUY: [...buyTokens],
  SELL: [...sellTokens],
};

export const INITIAL_STATE: SwapReducerState = {
  mode: SwapMode.Buy,
  inputToken: TICKER_SYMBOL.FRAX,
  outputToken: TICKER_SYMBOL.TEMPLE_TOKEN,
  inputValue: '',
  quoteValue: ZERO,
  inputTokenBalance: ZERO,
  outputTokenBalance: ZERO,
  slippageTolerance: 0.5,
  deadlineMinutes: 20,
  inputConfig: buildSelectConfig(TICKER_SYMBOL.FRAX, SwapMode.Buy),
  outputConfig: buildValueConfig(TICKER_SYMBOL.TEMPLE_TOKEN),
  buttonLabel: createButtonLabel(TICKER_SYMBOL.FRAX, TICKER_SYMBOL.TEMPLE_TOKEN, SwapMode.Buy),
  isTransactionPending: false,
  isFraxSellDisabled: false,
  error: null,
};

export const FALLBACK_VAULT_APY = 9;
