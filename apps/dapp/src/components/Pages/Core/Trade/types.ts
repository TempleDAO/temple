import { CryptoValue, CryptoSelector } from 'components/Input/Input';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';

export type SwapMode = 'BUY' | 'SELL';

type SwapInputConfig = CryptoSelector | CryptoValue;

export type SwapReducerAction =
  | { type: 'changeMode'; value: SwapMode }
  | {
      type: 'changeInputToken';
      value: { token: TICKER_SYMBOL; balance: number };
    }
  | {
      type: 'changeOutputToken';
      value: { token: TICKER_SYMBOL };
    }
  | { type: 'changeInputValue'; value: string }
  | { type: 'changeQuoteValue'; value: number }
  | { type: 'changeSlippageValue'; value: number }
  | { type: 'changeInputTokenBalance'; value: number }
  | { type: 'startTx' }
  | { type: 'endTx' }
  | { type: 'slippageTooHigh' };

export interface SwapReducerState {
  /*forceRefreshNonce: number;*/
  mode: SwapMode;
  ongoingTx: boolean;
  slippageTooHigh: boolean;
  zap: boolean;
  inputToken: TICKER_SYMBOL;
  outputToken: TICKER_SYMBOL;
  inputTokenBalance: number;
  inputValue: string;
  quoteValue: number;
  slippageValue: number;
  inputConfig: SwapInputConfig;
  outputConfig: SwapInputConfig;
}
