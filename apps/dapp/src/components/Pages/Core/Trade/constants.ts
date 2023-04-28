import { TICKER_SYMBOL } from 'enums/ticker-symbol';

import { SwapMode, SwapReducerState } from './types';
import { buildSelectConfig, buildValueConfig } from './utils';
import { ZERO } from 'utils/bigNumber';

const { DAI, FRAX, USDC, USDT, ETH, WETH, TEMPLE_TOKEN, OHM } = TICKER_SYMBOL;

export const TOKENS_BY_MODE = {
  BUY: [DAI, USDC, USDT, FRAX, ETH, WETH, OHM],
  SELL: [DAI, USDC, USDT, FRAX, ETH, WETH, OHM],
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
  inputConfig: buildSelectConfig(SwapMode.Buy),
  outputConfig: buildValueConfig(TEMPLE_TOKEN),
  isTransactionPending: false,
  error: null,
};

export const FALLBACK_VAULT_APY = 9;
