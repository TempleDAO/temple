import { BigNumber } from 'ethers';
import { CryptoValue, CryptoSelector } from 'components/Input/Input';
import { TransactionSettings } from 'components/TransactionSettingsModal/TransactionSettingsModal';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';

export enum SwapMode {
  Buy = 'BUY',
  Sell = 'SELL',
}

type SwapInputConfig = CryptoSelector | CryptoValue;

export type SwapReducerAction =
  | { type: 'changeMode'; value: SwapMode }
  | {
      type: 'changeInputToken';
      value: { token: TICKER_SYMBOL; balance: BigNumber };
    }
  | {
      type: 'changeOutputToken';
      value: { token: TICKER_SYMBOL; balance: BigNumber };
    }
  | { type: 'changeInputValue'; value: string }
  | { type: 'changeQuoteValue'; value: BigNumber }
  | { type: 'changeTxSettings'; value: TransactionSettings }
  | { type: 'changeInputTokenBalance'; value: BigNumber }
  | { type: 'changeOutputTokenBalance'; value: BigNumber }
  | { type: 'startTx' }
  | { type: 'endTx' }
  | { type: 'txSuccess' }
  | { type: 'slippageTooHigh' }
  | { type: 'setError'; value: Error | null };

export interface SwapReducerState {
  /*forceRefreshNonce: number;*/
  mode: SwapMode;
  inputToken: TICKER_SYMBOL;
  outputToken: TICKER_SYMBOL;
  inputValue: string;
  quoteValue: BigNumber;
  inputTokenBalance: BigNumber;
  outputTokenBalance: BigNumber;
  slippageTolerance: number;
  deadlineMinutes: number;
  inputConfig: SwapInputConfig;
  outputConfig: SwapInputConfig;
  buttonLabel: string;
  isTransactionPending: boolean;
  error: Error | null;
}
