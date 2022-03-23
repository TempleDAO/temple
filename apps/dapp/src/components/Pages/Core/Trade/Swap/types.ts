import { CryptoValue, CryptoSelector } from 'components/Input/Input';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';

export type SwapMode = 'BUY' | 'SELL';

export type SwapReducerAction =
  | { type: 'changeMode'; value: SwapMode }
  | {
      type: 'changeInputToken';
      value: { token: TICKER_SYMBOL; balance: number };
    }
  | { type: 'changeInputValue'; value: number }
  | { type: 'changeQuoteValue'; value: number }
  | { type: 'changeSlippageValue'; value: number }
  | { type: 'changeInputTokenBalance'; value: number }
  | { type: 'startTx' }
  | { type: 'endTx' }
  | { type: 'slippageTooHigh' };

export interface SwapReducerState {
  mode: SwapMode;
  ongoingTx: boolean;
  slippageTooHigh: boolean;
  zap: boolean;
  inputToken: TICKER_SYMBOL;
  outputToken: TICKER_SYMBOL;
  inputTokenBalance: number;
  inputValue: number;
  quoteValue: number;
  slippageValue: number;
  inputConfig: CryptoSelector;
  outputConfig: CryptoValue;
}
